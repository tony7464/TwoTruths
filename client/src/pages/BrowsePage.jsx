import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../useAuth";
import ErrorNote from "../components/ErrorNote";

export default function BrowsePage() {
  const { setUser } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState({});
  const [drafts, setDrafts] = useState({});
  const [sent, setSent] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/users")
      .then(setProfiles)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
      return;
    }

    setError("");
    try {
      const result = await api("/api/guesses", {
        method: "POST",
        body: JSON.stringify({
          profile_user_id: profile.id,
          statement_id: statementId,
        }),
      });

      setProfiles((current) => current.map((item) => {
        if (item.id !== profile.id) return item;
        return {
          ...item,
          fooled_count: result.fooled_count,
          my_guess: {
            is_correct: result.is_correct,
            statement_id: result.statement_id,
            messaging_unlocked: result.messaging_unlocked,
            lie: result.lie,
          },
        };
      }));
      setUser((current) => ({ ...current, score: result.score }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendMessage(profile) {
    setError("");
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          recipient_id: profile.id,
          body: messageDraft(profile),
        }),
      });
      setSent((current) => ({ ...current, [profile.id]: true }));
    } catch (err) {
      setError(err.message);
    }
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
      <ErrorNote message={error} />
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
          onSelect={(statementId) => setSelected((current) => ({ ...current, [profile.id]: statementId }))}
          onGuess={() => lockInGuess(profile)}
          message={messageDraft(profile)}
          onMessageChange={(value) => setDrafts((current) => ({ ...current, [profile.id]: value }))}
          onSend={() => sendMessage(profile)}
          sent={sent[profile.id]}
        />
      ))}
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
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                rows="2"
                value={message}
                onChange={(event) => onMessageChange(event.target.value)}
              />
              <button type="submit" className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
                Send
              </button>
            </>
          )}
        </form>
      )}
    </article>
  );
}
