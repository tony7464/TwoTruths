// Edit your two truths and a lie. The set locks after someone guesses.
import { useState } from "react";
import { api, run } from "../api";
import { useAuth } from "../AuthContext";
import ErrorNote from "./ErrorNote";

const EMPTY = ["", "", ""];

function draftsFrom(statements) {
  if (statements.length === 3) {
    return statements.map((statement) => statement.content);
  }
  return EMPTY;
}

function lieIndexFrom(statements) {
  const index = statements.findIndex((statement) => statement.is_lie);
  return index === -1 ? 0 : index;
}

export default function ProfileEditor({ compact = false }) {
  const { user, refreshUser } = useAuth();
  const existing = user.statements || [];
  const locked = user.statements_locked;
  const canEdit = !locked && (existing.length === 0 || existing.length === 3);
  const [drafts, setDrafts] = useState(() => draftsFrom(existing));
  const [lieIndex, setLieIndex] = useState(() => lieIndexFrom(existing));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm(statements) {
    setDrafts(draftsFrom(statements));
    setLieIndex(lieIndexFrom(statements));
  }

  function updateDraft(index, value) {
    setDrafts((current) => current.map((text, i) => (i === index ? value : text)));
  }

  async function save(action) {
    setNotice("");
    setSaving(true);
    try {
      await run(setError, action);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await save(async () => {
      if (existing.length === 0) {
        await api("/api/statements", "POST", {
          statements: drafts.map((content, index) => ({
            content,
            is_lie: index === lieIndex,
          })),
        });
      } else {
        // Mark the new lie first so the profile never has zero lies.
        await api(`/api/statements/${existing[lieIndex].id}`, "PATCH", {
          content: drafts[lieIndex],
          is_lie: true,
        });
        for (let index = 0; index < existing.length; index += 1) {
          if (index === lieIndex) continue;
          await api(`/api/statements/${existing[index].id}`, "PATCH", {
            content: drafts[index],
            is_lie: false,
          });
        }
      }
      const updated = await refreshUser();
      resetForm(updated?.statements || []);
      setNotice("Profile saved.");
    });
  }

  async function clearProfile() {
    await save(async () => {
      await api("/api/statements", "DELETE");
      resetForm([]);
      await refreshUser();
      setNotice("Statements deleted. Write a new set of three.");
    });
  }

  return (
    <section className={compact ? "space-y-2 text-[15px]" : "space-y-4"}>
      <div>
        <h1 className={compact ? "text-base font-semibold" : "text-2xl font-semibold"}>
          Your two truths and a lie
        </h1>
        <p className={compact ? "mt-1 text-[13px] text-stone-600" : "mt-1 text-sm text-stone-600"}>
          Other people only see the sentences. They have one guess to find the lie.
        </p>
      </div>

      {locked && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Someone has guessed, so these statements are locked.
        </p>
      )}
      {existing.length > 0 && existing.length !== 3 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          A profile needs exactly 3 statements. Delete the rest and start over.
        </p>
      )}

      <ErrorNote message={error} />
      {notice && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={handleSubmit} className={compact ? "space-y-3 rounded-xl bg-white p-3 shadow-sm" : "space-y-4 rounded-xl bg-white p-5 shadow-sm"}>
        {drafts.map((text, index) => (
          <fieldset key={index} className="space-y-2">
            <label className="block text-sm font-medium">
              Statement {index + 1}
              <textarea
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 font-normal"
                rows="2"
                value={text}
                disabled={!canEdit}
                onChange={(event) => updateDraft(index, event.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="radio"
                name="lie"
                checked={lieIndex === index}
                disabled={!canEdit}
                onChange={() => setLieIndex(index)}
              />
              This one is the lie
            </label>
          </fieldset>
        ))}

        {canEdit && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {existing.length === 3 ? "Save changes" : "Save profile"}
          </button>
        )}
      </form>

      {!locked && existing.length > 0 && (
        <button
          type="button"
          onClick={clearProfile}
          disabled={saving}
          className="text-sm text-rose-700 underline"
        >
          Delete statements and start over
        </button>
      )}
    </section>
  );
}
