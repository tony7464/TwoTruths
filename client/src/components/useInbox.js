// Loads messages and groups them into one thread per person.
import { useEffect, useRef, useState } from "react";
import { api, run } from "../api";
import { useAuth } from "../AuthContext";

const POLL_MS = 20000;

function tabHidden() {
  return document.hidden || document.visibilityState === "hidden";
}

function isAbort(err) {
  return err?.name === "AbortError";
}

function groupThreads(messages, userId) {
  const threads = new Map();

  for (const message of messages) {
    const mine = message.sender_id === userId;
    const otherId = mine ? message.recipient_id : message.sender_id;
    const otherName = mine ? message.recipient_username : message.sender_username;

    if (!threads.has(otherId)) {
      threads.set(otherId, { otherId, otherName, messages: [] });
    }
    threads.get(otherId).messages.push(message);
  }

  return [...threads.values()];
}

// `active` is true on the flat inbox page. The cube passes true only while the
// Inbox face is the one you can see. Polling stays off when the tab is hidden.
export function useInbox({ active = true } = {}) {
  const { user } = useAuth();
  const [reloadToken, setReloadToken] = useState(0);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState({});
  const activeRef = useRef(active);

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    api("/api/messages", "GET", undefined, controller.signal)
      .then((next) => {
        if (!current) return;
        setMessages(next);
        setError("");
      })
      .catch((err) => {
        if (!current || isAbort(err)) return;
        setError(err.message);
      })
      .finally(() => {
        // Only the first load shows the spinner. A refresh keeps the list on screen.
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [reloadToken]);

  useEffect(() => {
    const wasActive = activeRef.current;
    activeRef.current = active;
    if (active && !wasActive) reload();
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    let timer = null;

    function stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    }

    function start() {
      if (timer !== null || tabHidden()) return;
      timer = setInterval(() => {
        setReloadToken((token) => token + 1);
      }, POLL_MS);
    }

    function onVisibility() {
      if (tabHidden()) {
        stop();
        return;
      }
      start();
      setReloadToken((token) => token + 1);
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  const threads = user ? groupThreads(messages, user.id) : [];

  async function sendReply(otherId) {
    const created = await run(setError, () => api("/api/messages", "POST", {
      recipient_id: otherId,
      body: reply[otherId] || "",
    }));
    if (!created) return;
    setMessages((current) => [...current, created]);
    setReply((current) => ({ ...current, [otherId]: "" }));
  }

  return { threads, reply, setReply, sendReply, error, loading, reload };
}
