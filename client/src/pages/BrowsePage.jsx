// Flat list of profiles. A tap only highlights a statement; Lock in guess sends it.
import ErrorNote from "../components/ErrorNote";
import { useSpotTheLie } from "../components/useSpotTheLie";

export default function BrowsePage() {
  const {
    profiles,
    error,
    loading,
    selected,
    setSelected,
    setDrafts,
    messageDraft,
    lockInGuess,
    sendMessage,
    sending,
    sent,
  } = useSpotTheLie(true);

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
