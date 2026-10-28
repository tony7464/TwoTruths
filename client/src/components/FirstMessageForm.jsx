// The first note after a correct guess. The cube and the flat browse page share it.
export default function FirstMessageForm({
  compact = false,
  username,
  message,
  sending,
  sent,
  onMessageChange,
  onSend,
}) {
  const promptClass = compact
    ? "text-[15px] font-medium text-emerald-800"
    : "text-sm font-medium text-emerald-800";
  const sentClass = compact ? "text-[15px] text-stone-600" : "text-sm text-stone-600";
  const areaClass = compact
    ? "w-full rounded-md border border-[#d3e9f8] bg-white px-2 py-1 text-[15px] disabled:opacity-60"
    : "w-full rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-60";
  const buttonClass = compact
    ? "rounded-md bg-stone-900 px-2 py-1 text-[15px] text-white disabled:opacity-60"
    : "rounded-md bg-stone-900 px-3 py-2 text-sm text-white disabled:opacity-60";

  return (
    <form
      className={compact ? "mb-2 space-y-1" : "space-y-2"}
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <p className={promptClass}>Correct. Send the first message.</p>
      {sent ? (
        <p className={sentClass}>Sent. It is in your inbox.</p>
      ) : (
        <>
          <textarea
            className={areaClass}
            rows="2"
            maxLength={500}
            value={message}
            disabled={sending}
            aria-label={`Message to ${username}`}
            onChange={(event) => onMessageChange(event.target.value)}
          />
          <button type="submit" disabled={sending} className={buttonClass}>
            Send
          </button>
        </>
      )}
    </form>
  );
}
