import ErrorNote from "./ErrorNote";

export default function InboxThreads({ threads, reply, setReply, sendReply, error, compact = false }) {
  const articleClass = compact
    ? "space-y-2 border-b border-stone-200 py-2"
    : "space-y-3 rounded-xl bg-white p-5 shadow-sm";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <ErrorNote message={error} />
      {threads.length === 0 && (
        <p className={compact ? "text-sm text-stone-600" : "rounded-xl bg-white p-5 text-sm text-stone-600 shadow-sm"}>
          No messages yet. Guess a lie correctly, then send the first note.
        </p>
      )}
      {threads.map((thread) => (
        <article key={thread.otherId} className={articleClass}>
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
    </div>
  );
}
