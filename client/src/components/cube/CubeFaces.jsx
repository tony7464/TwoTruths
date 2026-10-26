import { LoginForm, SignupForm } from "../AuthForms";
import InboxThreads from "../InboxThreads";
import ProfileEditor from "../ProfileEditor";
import { useAuth } from "../../useAuth";
import { useInbox } from "../useInbox";

const shell = "h-full overflow-auto rounded-xl p-3 text-[15px] leading-snug text-stone-800";
const shellStyle = {
  background: "#f4fbff",
  border: "1px solid #d3eaf8",
  boxShadow: "0 1px 2px rgba(80, 120, 150, 0.08)",
};

const linkClass = "mt-2 text-[15px] text-emerald-800 underline";

export function StatementsFace({
  profile,
  selectedId,
  onSelect,
  onGuess,
  onShowPlayers,
  loading,
}) {
  const { user } = useAuth();

  if (loading) {
    return <p className={shell} style={shellStyle}>Loading profiles...</p>;
  }

  if (!profile) {
    return (
      <div className={`${shell} space-y-2`} style={shellStyle}>
        <p>Pick someone from the Players face</p>
        <button
          type="button"
          onClick={onShowPlayers}
          className="rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800"
        >
          Show players
        </button>
      </div>
    );
  }

  const guess = profile.my_guess;

  return (
    <div className={`${shell} space-y-1.5`} style={shellStyle}>
      <p className="text-[15px] text-stone-500">{profile.username}</p>
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
                className={`w-full rounded-md border px-2 py-1 text-left text-[15px] leading-tight ${
                  chosen && !guess ? "border-emerald-700 bg-emerald-50" : "border-[#d5e8f6] bg-white"
                } ${guess ? "cursor-default" : "hover:border-stone-400"}`}
              >
                {statement.content}
                {picked && <span className="ml-2 text-[13px] text-stone-500">Your guess</span>}
                {isLie && <span className="ml-2 text-[13px] font-medium text-rose-700">Lie</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {!guess && (
        <button
          type="button"
          onClick={onGuess}
          className="rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800"
        >
          Lock in guess
        </button>
      )}
      {guess && (
        <p className="text-[15px] text-stone-700">
          {guess.is_correct ? "Correct!" : "That was your one guess. Messaging stays closed."}
        </p>
      )}
      {guess && <p className="text-[13px] text-stone-500">score {user?.score}</p>}
    </div>
  );
}

export function ProfileFace() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className={shell} style={shellStyle}>
      {user.bio ? <p className="text-[15px] text-stone-600">{user.bio}</p> : null}
      <p className="mb-2 text-[13px] text-stone-500">score {user.score}</p>
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
    <div className={`${shell} space-y-1`} style={shellStyle} aria-label="Players">
      {profiles.length === 0 && (
        <p className="text-[15px] text-stone-600">No finished profiles yet.</p>
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
            className={`flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-[15px] ${
              current ? "border-emerald-700 bg-emerald-50" : "border-[#d5e8f6] bg-white hover:border-stone-400"
            }`}
          >
            <span className="font-medium">{profile.username}</span>
            <span className="text-[13px] text-stone-500">score {profile.score}</span>
            <span className={`rounded px-1 text-[13px] ${
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
    <div className={shell} style={{ ...shellStyle, opacity }}>
      {unlocked ? (
        <form
          className="mb-2 space-y-1"
          onSubmit={(event) => {
            event.preventDefault();
            onSend();
          }}
        >
          <p className="text-[15px] font-medium text-emerald-800">Correct. Send the first message.</p>
          {sent ? (
            <p className="text-[15px] text-stone-600">Sent. It is in your inbox.</p>
          ) : (
            <>
              <textarea
                className="w-full rounded-md border border-[#d3e9f8] bg-white px-2 py-1 text-[15px] disabled:opacity-60"
                rows="2"
                value={message}
                disabled={sending}
                aria-label={`Message to ${profile.username}`}
                onChange={(event) => onMessageChange(event.target.value)}
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-md bg-stone-900 px-2 py-1 text-[15px] text-white disabled:opacity-60"
              >
                Send
              </button>
            </>
          )}
        </form>
      ) : (
        <p className="mb-2 text-[15px] text-stone-700">Guess someone correctly to unlock messaging</p>
      )}
      {inbox.loading ? (
        <p className="text-[15px] text-stone-600">Loading inbox...</p>
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

export function LoginFace({ onSuccess, onFailure, onShowSignup }) {
  return (
    <div className={shell} style={shellStyle}>
      <h2 className="mb-2 text-base font-semibold">Log in</h2>
      <LoginForm compact onSuccess={onSuccess} onFailure={onFailure} />
      <button type="button" onClick={onShowSignup} className={linkClass}>
        Need an account? Sign up
      </button>
      <p className="mt-2 text-[13px] text-stone-500">
        Demo users: alex, jordan, sam, riley. Password: password123
      </p>
    </div>
  );
}

export function SignupFace({ onSuccess, onFailure, onShowLogin }) {
  return (
    <div className={shell} style={shellStyle}>
      <h2 className="mb-1 text-base font-semibold">Sign up</h2>
      <p className="mb-2 text-[13px] text-stone-600">You will add two truths and one lie next.</p>
      <SignupForm compact onSuccess={onSuccess} onFailure={onFailure} />
      <button type="button" onClick={onShowLogin} className={linkClass}>
        Already have an account? Log in
      </button>
    </div>
  );
}

export function GuestNote({ children }) {
  return (
    <p className={shell} style={shellStyle}>{children}</p>
  );
}
