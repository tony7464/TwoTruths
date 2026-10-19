export default function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  );
}
