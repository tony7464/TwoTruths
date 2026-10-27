// Log-in and sign-up forms shared by the flat pages and the cube faces.
import { useState } from "react";
import { run } from "../api";
import { useAuth } from "../AuthContext";
import ErrorNote from "./ErrorNote";

function fieldClass(compact) {
  if (compact) {
    return "mt-1 w-full rounded-md border border-[#d3e9f8] bg-white px-2 py-1 text-[15px]";
  }
  return "mt-1 w-full rounded-md border border-stone-300 px-3 py-2";
}

function labelClass(compact) {
  if (compact) return "block text-[15px]";
  return "block text-sm";
}

function submitClass(compact) {
  if (compact) {
    return "w-full rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800";
  }
  return "w-full rounded-md bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800";
}

export function LoginForm({ compact = false, onSuccess, onFailure }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await run(setError, () => login(username, password));
    if (result) onSuccess?.();
    else onFailure?.();
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-2" : "space-y-4"}>
      <ErrorNote message={error} />
      <label className={labelClass(compact)}>
        Username
        <input
          className={fieldClass(compact)}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </label>
      <label className={labelClass(compact)}>
        Password
        <input
          type="password"
          className={fieldClass(compact)}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </label>
      <button
        type="submit"
        className={submitClass(compact)}
      >
        Log in
      </button>
    </form>
  );
}

export function SignupForm({ compact = false, onSuccess, onFailure }) {
  const { signup } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    const result = await run(setError, () => signup({ username, password, bio }));
    if (result) onSuccess?.();
    else onFailure?.();
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? "space-y-2" : "space-y-4"}>
      <ErrorNote message={error} />
      <label className={labelClass(compact)}>
        Username
        <input
          className={fieldClass(compact)}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </label>
      <label className={labelClass(compact)}>
        Password
        <input
          type="password"
          className={fieldClass(compact)}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className={labelClass(compact)}>
        Bio <span className="text-stone-500">(optional)</span>
        <textarea
          className={fieldClass(compact)}
          rows={compact ? 2 : 3}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </label>
      <button
        type="submit"
        className={submitClass(compact)}
      >
        Sign up
      </button>
    </form>
  );
}
