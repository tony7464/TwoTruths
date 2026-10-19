import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../useAuth";
import ErrorNote from "../components/ErrorNote";

export default function InboxPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/messages")
      .then(setMessages)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const threads = groupThreads(messages, user.id);

  async function sendReply(otherId) {
    setError("");
    try {
      const created = await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          recipient_id: otherId,
          body: reply[otherId] || "",
        }),
      });
      setMessages((current) => [...current, created]);
      setReply((current) => ({ ...current, [otherId]: "" }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="text-stone-600">Loading inbox...</p>;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-stone-600">
          A correct guess opens a thread. Both people can write in it.
        </p>
      </div>
      <ErrorNote message={error} />
      {threads.length === 0 && (
        <p className="rounded-xl bg-white p-5 text-sm text-stone-600 shadow-sm">
          No messages yet. Guess a lie correctly, then send the first note.
        </p>
      )}
      {threads.map((thread) => (
        <article key={thread.otherId} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold">{thread.otherName}</h2>
          <ul className="space-y-2">
            {thread.messages.map((message) => (
              <li key={message.id} className="text-sm">
                <span className="font-medium">{message.sender_username}: </span>
                {message.body}
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendReply(thread.otherId);
            }}
          >
            <input
              className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm"
              placeholder={`Reply to ${thread.otherName}`}
              value={reply[thread.otherId] || ""}
              onChange={(event) => setReply((current) => ({
                ...current,
                [thread.otherId]: event.target.value,
              }))}
            />
            <button type="submit" className="rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
              Reply
            </button>
          </form>
        </article>
      ))}
    </section>
  );
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
