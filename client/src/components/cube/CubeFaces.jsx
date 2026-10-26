import ProfileEditor from "../ProfileEditor";
import InboxThreads from "../InboxThreads";
import { useAuth } from "../../useAuth";
import { useInbox } from "../useInbox";

const shell = "h-full overflow-auto bg-white/95 p-2 text-stone-900";

export function StatementsFace({ profile, selectedId, onSelect, onGuess }) {
  const { user } = useAuth();

  if (!profile) {
    return <p className={`${shell} text-sm`}>Pick someone from the player list</p>;
  }

  const guess = profile.my_guess;

  return (
    <div className={`${shell} space-y-1.5`}>
      <p className="text-xs text-stone-500">{profile.username}</p>
      <ul className="space-y-1">
        {profile.statements.map((statement) => {
          const picked = guess?.statement_id === statement.id;
          const isLie = guess && guess.lie.id === statement.id;
          const chosen = selectedId === statement.id;
          return (
            <li key={statement.id}>
              <button
                type="button"
                disabled={Boolean(guess)}
                aria-pressed={chosen}
                onClick={() => onSelect(statement.id)}
                className={`w-full rounded-md border px-2 py-1 text-left text-sm leading-tight ${
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
          className="rounded-md bg-emerald-700 px-2 py-1 text-sm text-white hover:bg-emerald-800"
        >
          Lock in guess
        </button>
      )}
      {guess && (
        <p className="text-sm text-stone-700">
          {guess.is_correct ? "Correct!" : "That was your one guess. Messaging stays closed."}
        </p>
      )}
      {guess && <p className="text-xs text-stone-500">score {user?.score}</p>}
    </div>
  );
}

export function ProfileFace() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className={shell}>
      {user.bio ? <p className="text-sm text-stone-600">{user.bio}</p> : null}
      <p className="mb-2 text-xs text-stone-500">score {user.score}</p>
      <ProfileEditor compact />
    </div>
  );
}

function guessBadge(profile) {
  if (!profile.my_guess) return "not yet";
  return profile.my_guess.is_correct ? "correct" : "wrong";
}

export function PlayersFace({ profiles, currentId, onPick }) {
  return (
    <div className={`${shell} space-y-1`} aria-label="Players">
      {profiles.length === 0 && (
        <p className="text-sm text-stone-600">No finished profiles yet.</p>
      )}
      {profiles.map((profile) => {
        const badge = guessBadge(profile);
        const current = profile.id === currentId;
        return (
          <button
            key={profile.id}
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={() => onPick(profile.id)}
            className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-sm ${
              current ? "border-emerald-700 bg-emerald-50" : "border-stone-200 hover:border-stone-400"
            }`}
          >
            <span className="font-medium">{profile.username}</span>
            <span className="text-xs text-stone-500">score {profile.score}</span>
            <span className={`rounded px-1 text-xs ${
              badge === "correct" ? "bg-emerald-100 text-emerald-800" : ""
            } ${badge === "wrong" ? "bg-rose-100 text-rose-800" : ""} ${
              badge === "not yet" ? "bg-stone-100 text-stone-600" : ""
            }`}
            >
              {badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function InboxFace({
  profile,
  message,
  onMessageChange,
  onSend,
  sending,
  sent,
  opacity,
}) {
  const inbox = useInbox();
  const unlocked = Boolean(profile?.my_guess?.messaging_unlocked);

  return (
    <div className={shell} style={{ opacity }}>
      {unlocked ? (
        <form
          className="mb-2 space-y-1"
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
                className="w-full rounded-md border border-stone-300 px-2 py-1 text-sm disabled:opacity-60"
                rows="2"
                value={message}
                disabled={sending}
                aria-label={`Message to ${profile.username}`}
                onChange={(event) => onMessageChange(event.target.value)}
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-stone-900 px-2 py-1 text-sm text-white disabled:opacity-60"
              >
                Send
              </button>
            </>
          )}
        </form>
      ) : (
        <p className="mb-2 text-sm text-stone-700">Guess someone correctly to unlock messaging</p>
      )}
      {inbox.loading ? (
        <p className="text-sm text-stone-600">Loading inbox...</p>
      ) : (
        <InboxThreads
          compact
          threads={inbox.threads}
          reply={inbox.reply}
          setReply={inbox.setReply}
          sendReply={inbox.sendReply}
          error={inbox.error}
        />
      )}
    </div>
  );
}
