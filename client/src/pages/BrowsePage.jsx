import { lazy, Suspense, useRef, useState } from "react";
import { api, run } from "../api";
import { useAuth } from "../useAuth";
import { useLoaded } from "../useLoaded";
import ErrorNote from "../components/ErrorNote";
import CubeErrorBoundary from "../components/cube/CubeErrorBoundary";
import { useCubeMode } from "../components/cube/useCubeMode";

const CubeScene = lazy(() => import("../components/cube/CubeScene"));

export default function BrowsePage() {
  const { user, setUser } = useAuth();
  const { data: profiles, setData: setProfiles, error, setError, loading } = useLoaded("/api/users", []);
  const [selected, setSelected] = useState({});
  const [drafts, setDrafts] = useState({});
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState({});
  const [pickedId, setPickedId] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const messageLock = useRef(new Set());
  const { mode, supported, chooseFlat, chooseCube } = useCubeMode(loadFailed);
  const current = profiles.find((profile) => profile.id === pickedId)
    || profiles.find((profile) => !profile.my_guess)
    || profiles[0]
    || null;

  function messageDraft(profile) {
    if (drafts[profile.id] !== undefined) return drafts[profile.id];
    if (profile.my_guess?.messaging_unlocked) {
      return `I knew "${profile.my_guess.lie.content}" was the lie!`;
    }
    return "";
  }

  async function lockInGuess(profile) {
    const statementId = selected[profile.id];
    if (!statementId) {
      setError("Pick a statement first. You only get one guess.");
      return null;
    }

    const result = await run(setError, () => api("/api/guesses", "POST", {
      profile_user_id: profile.id,
      statement_id: statementId,
    }));
    if (!result) return null;

    setProfiles((items) => items.map((item) => {
      if (item.id === profile.id) {
        return {
          ...item,
          score: result.profile_score,
          fooled_count: result.fooled_count,
          my_guess: {
            is_correct: result.is_correct,
            statement_id: result.statement_id,
            messaging_unlocked: result.messaging_unlocked,
            lie: result.lie,
          },
        };
      }
      if (user && item.id === user.id) {
        return { ...item, score: result.score };
      }
      return item;
    }));
    setUser((item) => {
      if (!item || item.id !== user?.id) return item;
      return { ...item, score: result.score };
    });
    return result;
  }

  async function sendMessage(profile) {
    if (messageLock.current.has(profile.id)) return;
    messageLock.current.add(profile.id);
    setSending((items) => ({ ...items, [profile.id]: true }));

    const created = await run(setError, () => api("/api/messages", "POST", {
      recipient_id: profile.id,
      body: messageDraft(profile),
    }));

    if (!created) {
      messageLock.current.delete(profile.id);
      setSending((items) => ({ ...items, [profile.id]: false }));
      return;
    }

    setDrafts((items) => ({ ...items, [profile.id]: "" }));
    setSent((items) => ({ ...items, [profile.id]: true }));
    setSending((items) => ({ ...items, [profile.id]: false }));
  }

  if (loading) return <p className="text-stone-600">Loading profiles...</p>;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Spot the lie</h1>
        <p className="mt-1 text-sm text-stone-600">
          One guess per person. A correct guess unlocks a message.
        </p>
      </div>
      {supported && (
        <button
          type="button"
          onClick={mode === "cube" ? chooseFlat : chooseCube}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50"
        >
          {mode === "cube" ? "Use flat view" : "Use 3D cube"}
        </button>
      )}
      <ErrorNote message={error} />
      {mode === "cube" ? (
        <CubeErrorBoundary onError={() => setLoadFailed(true)}>
          <Suspense fallback={<p className="text-sm text-stone-600">Loading cube...</p>}>
            <CubeScene
              profiles={profiles}
              current={current}
              onPick={setPickedId}
              selectedId={current ? selected[current.id] : undefined}
              onSelect={(statementId) => {
                if (!current) return;
                setSelected((items) => ({ ...items, [current.id]: statementId }));
              }}
              onGuess={() => (current ? lockInGuess(current) : Promise.resolve(null))}
              message={current ? messageDraft(current) : ""}
              onMessageChange={(value) => {
                if (!current) return;
                setDrafts((items) => ({ ...items, [current.id]: value }));
              }}
              onSend={() => current && sendMessage(current)}
              sending={Boolean(current && sending[current.id])}
              sent={Boolean(current && sent[current.id])}
            />
          </Suspense>
        </CubeErrorBoundary>
      ) : (
        <div className="space-y-4">
          {profiles.length === 0 && (
            <p className="rounded-xl bg-white p-5 text-sm text-stone-600 shadow-sm">
              No finished profiles yet. Check back after someone writes three statements.
            </p>
          )}
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              selectedId={selected[profile.id]}
              onSelect={(statementId) => setSelected((items) => ({ ...items, [profile.id]: statementId }))}
              onGuess={() => lockInGuess(profile)}
              message={messageDraft(profile)}
              onMessageChange={(value) => setDrafts((items) => ({ ...items, [profile.id]: value }))}
              onSend={() => sendMessage(profile)}
              sending={Boolean(sending[profile.id])}
              sent={sent[profile.id]}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProfileCard({
  profile,
  selectedId,
  onSelect,
  onGuess,
  message,
  onMessageChange,
  onSend,
  sending,
  sent,
}) {
  const guess = profile.my_guess;

  return (
    <article className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{profile.username}</h2>
          {profile.bio && <p className="text-sm text-stone-600">{profile.bio}</p>}
        </div>
        <p className="text-xs text-stone-500">
          score {profile.score} · fooled {profile.fooled_count}
        </p>
      </header>

      <ul className="space-y-2">
        {profile.statements.map((statement) => {
          const picked = guess?.statement_id === statement.id;
          const isLie = guess && guess.lie.id === statement.id;
          const chosen = selectedId === statement.id;
          return (
            <li key={statement.id}>
              <button
                type="button"
                disabled={Boolean(guess)}
                onClick={() => onSelect(statement.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  chosen && !guess ? "border-emerald-700 bg-emerald-50" : "border-stone-200"
                } ${guess ? "cursor-default" : "hover:border-stone-400"}`}
              >
                {statement.content}
                {picked && <span className="ml-2 text-xs text-stone-500">Your guess</span>}
                {isLie && <span className="ml-2 text-xs font-medium text-rose-700">Lie</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {!guess && (
        <button
          type="button"
          onClick={onGuess}
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
        >
          Lock in guess
        </button>
      )}

      {guess && !guess.is_correct && (
        <p className="text-sm text-stone-700">
          That's your one guess. Messaging stays closed.
        </p>
      )}

      {guess?.messaging_unlocked && (
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <p className="text-sm font-medium text-emerald-800">Correct. Send the first message.</p>
          {sent ? (
            <p className="text-sm text-stone-600">Sent. It is in your inbox.</p>
          ) : (
            <>
              <textarea
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-60"
                rows="2"
                value={message}
                disabled={sending}
                onChange={(event) => onMessageChange(event.target.value)}
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              >
                Send
              </button>
            </>
          )}
        </form>
      )}
    </article>
  );
}
