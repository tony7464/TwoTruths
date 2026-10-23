import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { run } from "../api";
import { useAuth } from "../useAuth";
import ErrorNote from "../components/ErrorNote";

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");

  if (loading) return <p className="p-8 text-center text-stone-600">Loading...</p>;
  if (user) return <Navigate to="/browse" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    await run(setError, () => signup({ username, password, bio }));
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Create your profile</h1>
          <p className="mt-1 text-sm text-stone-600">You will add two truths and one lie next.</p>
        </div>
        <ErrorNote message={error} />
        <label className="block text-sm">
          Username
          <input
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>
        <label className="block text-sm">
          Bio <span className="text-stone-500">(optional)</span>
          <textarea
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            rows="3"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>
        <button type="submit" className="w-full rounded-md bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800">
          Sign up
        </button>
        <p className="text-sm text-stone-600">
          Already have an account? <Link to="/login" className="text-emerald-800 underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}
