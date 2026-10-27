// Flat inbox. A thread opens after a correct guess in either direction.
import InboxThreads from "../components/InboxThreads";
import { useInbox } from "../components/useInbox";

export default function InboxPage() {
  const { threads, reply, setReply, sendReply, error, loading } = useInbox();

  if (loading) return <p className="text-stone-600">Loading inbox...</p>;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-stone-600">
          A correct guess opens a thread. Both people can write in it.
        </p>
      </div>
      <InboxThreads
        threads={threads}
        reply={reply}
        setReply={setReply}
        sendReply={sendReply}
        error={error}
      />
    </section>
  );
}
