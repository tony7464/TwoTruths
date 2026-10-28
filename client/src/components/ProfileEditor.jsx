// Edit your two truths and a lie. The set locks after someone guesses.
import { useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, run } from "../api";
import { useAuth } from "../AuthContext";
import ErrorNote from "./ErrorNote";
import {
  BIO_MIN_ROWS,
  COMPACT_CHARS_PER_ROW,
  RELAXED_CHARS_PER_ROW,
  STATEMENT_MIN_ROWS,
  applyTextareaHeight,
  rowsForContent,
} from "./profileRows";

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

function GrowingTextarea({ value, minRows, charsPerRow, className, ...props }) {
  const ref = useRef(null);
  const rows = rowsForContent(value, minRows, charsPerRow);

  useLayoutEffect(() => {
    const node = ref.current;
    if (node) applyTextareaHeight(node);
  }, [value, rows]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      className={className}
      {...props}
    />
  );
}

function DeleteAccount({ compact }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function cancel() {
    setOpen(false);
    setPassword("");
    setError("");
  }

  async function handleDelete(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await run(setError, () => api("/api/account", "DELETE", { password }));
      if (!result) return;
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const opener = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="text-sm text-rose-700 underline"
    >
      Delete my account
    </button>
  );

  const form = (
    <form onSubmit={handleDelete} className="space-y-2">
      <p className="text-sm font-medium text-rose-800">Delete my account</p>
      <label className="block text-sm">
        Password
        <input
          type="password"
          className="mt-1 w-full rounded-md border border-rose-300 px-2 py-1 font-normal"
          value={password}
          required
          minLength={6}
          maxLength={72}
          title="6 to 72 characters"
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-rose-700 px-2 py-1 text-sm text-rose-800 disabled:opacity-60"
        >
          Yes, delete everything
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="rounded-md border border-stone-300 px-2 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
      <ErrorNote message={error} />
    </form>
  );

  // On the cube, a link grows into the password form. The flat page keeps the box.
  if (compact) return open ? form : opener;

  return (
    <div className="mt-4 rounded-md border-2 border-rose-700 p-3">
      {open ? form : opener}
    </div>
  );
}

export default function ProfileEditor({ compact = false }) {
  const { user, refreshUser, setUser } = useAuth();
  const existing = user?.statements || [];
  const locked = Boolean(user?.statements_locked);
  const canEdit = !locked && (existing.length === 0 || existing.length === 3);
  const [drafts, setDrafts] = useState(() => draftsFrom(existing));
  const [lieIndex, setLieIndex] = useState(() => lieIndexFrom(existing));
  const [bio, setBio] = useState(() => user?.bio || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

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

  async function handleBio(event) {
    event.preventDefault();
    await save(async () => {
      const updated = await api("/api/profile", "PATCH", { bio });
      setUser(updated);
      setBio(updated?.bio || "");
      setNotice("Saved.");
    });
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
      setConfirmClear(false);
    });
  }

  if (!user) return null;

  const saveClass = compact
    ? "rounded-md bg-emerald-700 px-3 py-1 text-sm text-white hover:bg-emerald-800 disabled:opacity-60"
    : "rounded-md bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 disabled:opacity-60";

  const intro = (
    <div>
      <h1 className={compact ? "text-base font-semibold leading-tight" : "text-2xl font-semibold"}>
        Your two truths and a lie
      </h1>
      <p className={compact ? "mt-0.5 text-sm leading-snug text-stone-600" : "mt-1 text-sm text-stone-600"}>
        Other people only see the sentences. They have one guess to find the lie.
      </p>
    </div>
  );

  const lockedNote = locked ? (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
      Someone has guessed, so these statements are locked.
    </p>
  ) : null;

  const countNote = existing.length > 0 && existing.length !== 3 ? (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
      A profile needs exactly 3 statements. Delete the rest and start over.
    </p>
  ) : null;

  const noticeNote = notice ? (
    <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {notice}
    </p>
  ) : null;

  const bioForm = (
    <form onSubmit={handleBio} className={compact ? "space-y-1" : "space-y-3"}>
      <label className="block text-sm font-medium">
        Bio
        <GrowingTextarea
          className={compact
            ? "mt-0.5 w-full resize-none overflow-hidden rounded-md border border-stone-300 px-2 py-1 font-normal"
            : "mt-1 w-full resize-none overflow-hidden rounded-md border border-stone-300 px-3 py-2 font-normal"}
          minRows={BIO_MIN_ROWS}
          charsPerRow={compact ? COMPACT_CHARS_PER_ROW : RELAXED_CHARS_PER_ROW}
          maxLength={160}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </label>
      <button type="submit" disabled={saving} className={saveClass}>
        Save
      </button>
    </form>
  );

  const statementForm = (
    <form
      onSubmit={handleSubmit}
      className={compact
        ? "space-y-1.5 rounded-lg bg-white p-2"
        : "space-y-4 rounded-xl bg-white p-5 shadow-sm"}
    >
      {drafts.map((text, index) => (
        <fieldset key={index} className={compact ? "space-y-1" : "space-y-2"}>
          <label className="block text-sm font-medium">
            Statement {index + 1}
            <GrowingTextarea
              className={compact
                ? "mt-0.5 w-full resize-none overflow-hidden rounded-md border border-stone-300 px-2 py-1 text-sm font-normal"
                : "mt-1 w-full resize-none overflow-hidden rounded-md border border-stone-300 px-3 py-2 font-normal"}
              minRows={STATEMENT_MIN_ROWS}
              charsPerRow={compact ? COMPACT_CHARS_PER_ROW : RELAXED_CHARS_PER_ROW}
              required
              maxLength={200}
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
        <button type="submit" disabled={saving} className={saveClass}>
          {existing.length === 3 ? "Save changes" : "Save profile"}
        </button>
      )}
    </form>
  );

  const clearBlock = !locked && existing.length > 0 ? (
    confirmClear ? (
      <div className="space-y-2">
        <p>Delete all three statements and start over?</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={clearProfile}
            disabled={saving}
            className="text-sm text-rose-700 underline"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(false)}
            disabled={saving}
            className="text-sm text-stone-600 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmClear(true)}
        disabled={saving}
        className="text-sm text-rose-700 underline"
      >
        Delete statements and start over
      </button>
    )
  ) : null;

  const deleteBlock = <DeleteAccount compact={compact} />;

  if (compact) {
    return (
      <section className="grid h-full min-h-0 grid-cols-2 items-start gap-2 text-[15px]">
        <div className="min-w-0 space-y-1.5">
          {intro}
          {lockedNote}
          {countNote}
          <ErrorNote message={error} />
          {noticeNote}
          {bioForm}
          {deleteBlock}
        </div>
        <div className="max-h-full min-h-0 min-w-0 space-y-1.5 overflow-y-auto">
          {statementForm}
          {clearBlock}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {intro}
      {lockedNote}
      {countNote}
      <ErrorNote message={error} />
      {noticeNote}
      {bioForm}
      {statementForm}
      {clearBlock}
      {deleteBlock}
    </section>
  );
}
