// The words drawn on each face of the cube.
import { useAuth } from "../AuthContext";
import { LoginForm, SignupForm } from "../components/AuthForms";
import FirstMessageForm from "../components/FirstMessageForm";
import InboxThreads from "../components/InboxThreads";
import ProfileEditor from "../components/ProfileEditor";
import { useInbox } from "../components/useInbox";
import { useGame } from "./gameContext";

const shell = "h-full overflow-auto rounded-xl p-3 text-[15px] leading-snug text-stone-800";
const shellStyle = {
  background: "#f4fbff",
  border: "1px solid #d3eaf8",
  boxShadow: "0 1px 2px rgba(80, 120, 150, 0.08)",
};

const linkClass = "mt-2 text-[15px] text-emerald-800 underline";

export function Panel({ as: Tag = "div", className = "", style, children, ...rest }) {
  return (
    <Tag
      className={className ? `${shell} ${className}` : shell}
      style={style ? { ...shellStyle, ...style } : shellStyle}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function StatementsFace() {
  const { user } = useAuth();
  const { game, onGuess, onShowPlayers } = useGame();
  const profile = game.current;
  const selectedId = profile ? game.selected[profile.id] : undefined;
  const loading = game.loading;

  function choose(statementId) {
    game.setSelected((items) => ({ ...items, [profile.id]: statementId }));
  }

  if (loading) {
    return <Panel as="p">Loading profiles...</Panel>;
  }

  if (!profile) {
    return (
      <Panel className="space-y-2">
        <p>Pick someone from the Players face</p>
        <button
          type="button"
          onClick={onShowPlayers}
          className="rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800"
        >
          Show players
        </button>
      </Panel>
    );
  }

  const guess = profile.my_guess;

  return (
    <Panel className="space-y-1.5">
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
                onClick={() => choose(statement.id)}
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
    </Panel>
  );
}

export function ProfileFace() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <Panel className="flex flex-col" style={{ padding: 10, overflow: "hidden" }}>
      <p className="mb-1 shrink-0 text-[13px] text-stone-500">score {user.score}</p>
      <div className="min-h-0 flex-1">
        <ProfileEditor compact />
      </div>
    </Panel>
  );
}

function guessBadge(profile) {
  if (!profile.my_guess) return "not yet";
  if (profile.my_guess.is_correct) return "correct";
  return "wrong";
}

function badgeClass(badge) {
  if (badge === "correct") return "bg-emerald-100 text-emerald-800";
  if (badge === "wrong") return "bg-rose-100 text-rose-800";
  return "bg-stone-100 text-stone-600";
}

export function PlayersFace() {
  const { game, onPick } = useGame();
  const profiles = game.profiles;
  const currentId = game.current?.id;

  return (
    <Panel className="space-y-1" aria-label="Players">
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
            <span className={`rounded px-1 text-[13px] ${badgeClass(badge)}`}>
              {badge}
            </span>
          </button>
        );
      })}
    </Panel>
  );
}

export function InboxFace() {
  const { game, anim } = useGame();
  const profile = game.current;
  const active = anim.activeFace === "right" && !anim.locked;
  const inbox = useInbox({ active });
  const unlocked = Boolean(profile?.my_guess?.messaging_unlocked);
  const sending = Boolean(profile && game.sending[profile.id]);
  const sent = Boolean(profile && game.sent[profile.id]);
  const message = profile ? game.messageDraft(profile) : "";

  async function handleSend() {
    if (!profile) return;
    const created = await game.sendMessage(profile);
    if (created) inbox.reload();
  }

  return (
    <Panel style={{ opacity: anim.inboxOpacity }}>
      {unlocked ? (
        <FirstMessageForm
          compact
          username={profile.username}
          message={message}
          sending={sending}
          sent={sent}
          onMessageChange={(value) => {
            game.setDrafts((items) => ({ ...items, [profile.id]: value }));
          }}
          onSend={handleSend}
        />
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
    </Panel>
  );
}

export function LoginFace() {
  const { onLoginSuccess, onLoginFailure, onShowSignup } = useGame();

  return (
    <Panel>
      <h2 className="mb-2 text-base font-semibold">Log in</h2>
      <LoginForm compact onSuccess={onLoginSuccess} onFailure={onLoginFailure} />
      <button type="button" onClick={onShowSignup} className={linkClass}>
        Need an account? Sign up
      </button>
      <p className="mt-2 text-[13px] text-stone-500">
        Demo users: alex, jordan, sam, riley. Password: password123
      </p>
    </Panel>
  );
}

export function SignupFace() {
  const { onSignupSuccess, onSignupFailure, onShowLogin } = useGame();

  return (
    <Panel>
      <h2 className="mb-1 text-base font-semibold">Sign up</h2>
      <p className="mb-2 text-[13px] text-stone-600">You will add two truths and one lie next.</p>
      <SignupForm compact onSuccess={onSignupSuccess} onFailure={onSignupFailure} />
      <button type="button" onClick={onShowLogin} className={linkClass}>
        Already have an account? Log in
      </button>
    </Panel>
  );
}

export function GuestNote({ children }) {
  return (
    <Panel as="p">{children}</Panel>
  );
}
