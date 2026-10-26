import { useState } from "react";
import { api, run } from "../api";
import { useAuth } from "../useAuth";
import { useLoaded } from "../useLoaded";

export function groupThreads(messages, userId) {
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

export function useInbox() {
  const { user } = useAuth();
  const { data: messages, setData: setMessages, error, setError, loading } = useLoaded("/api/messages", []);
  const [reply, setReply] = useState({});
  const threads = groupThreads(messages, user.id);

  async function sendReply(otherId) {
    const created = await run(setError, () => api("/api/messages", "POST", {
      recipient_id: otherId,
      body: reply[otherId] || "",
    }));
    if (!created) return;
    setMessages((current) => [...current, created]);
    setReply((current) => ({ ...current, [otherId]: "" }));
  }

  return { threads, reply, setReply, sendReply, error, loading };
}
