import { useEffect, useRef, useState } from "react";
import { api, run } from "../../api";
import { useAuth } from "../../useAuth";

export function useSpotTheLie(active) {
  const { user, setUser } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState({});
  const [drafts, setDrafts] = useState({});
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState({});
  const [pickedId, setPickedId] = useState(null);
  const [session, setSession] = useState(() => ({ active, loading: Boolean(active) }));
  const messageLock = useRef(new Set());

  if (session.active !== active) {
    setSession({ active, loading: Boolean(active) });
  }

  useEffect(() => {
    if (!active) return undefined;
    let dead = false;
    api("/api/users")
      .then((data) => {
        if (!dead) setProfiles(data);
      })
      .catch((err) => {
        if (!dead) setError(err.message);
      })
      .finally(() => {
        if (!dead) setSession((current) => ({ ...current, loading: false }));
      });
    return () => {
      dead = true;
    };
  }, [active]);

  const loading = session.loading;

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

  return {
    profiles,
    error,
    loading,
    current,
    selected,
    setSelected,
    setPickedId,
    drafts,
    setDrafts,
    sending,
    sent,
    messageDraft,
    lockInGuess,
    sendMessage,
  };
}
