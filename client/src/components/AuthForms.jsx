import { useState } from "react";
import { run } from "../api";
import { useAuth } from "../useAuth";
import ErrorNote from "./ErrorNote";

function fieldClass(compact) {
  return compact
    ? "mt-1 w-full rounded-md border border-[#d3e9f8] bg-white px-2 py-1 text-[15px]"
    : "mt-1 w-full rounded-md border border-stone-300 px-3 py-2";
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
      <label className={compact ? "block text-[15px]" : "block text-sm"}>
        Username
        <input
          className={fieldClass(compact)}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </label>
      <label className={compact ? "block text-[15px]" : "block text-sm"}>
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
        className={compact
          ? "w-full rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800"
          : "w-full rounded-md bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"}
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
      <label className={compact ? "block text-[15px]" : "block text-sm"}>
        Username
        <input
          className={fieldClass(compact)}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
        />
      </label>
      <label className={compact ? "block text-[15px]" : "block text-sm"}>
        Password
        <input
          type="password"
          className={fieldClass(compact)}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
        />
      </label>
      <label className={compact ? "block text-[15px]" : "block text-sm"}>
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
        className={compact
          ? "w-full rounded-md bg-emerald-700 px-2 py-1 text-[15px] text-white hover:bg-emerald-800"
          : "w-full rounded-md bg-emerald-700 px-3 py-2 text-white hover:bg-emerald-800"}
      >
        Sign up
      </button>
    </form>
  );
}
