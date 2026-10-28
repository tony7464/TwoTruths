// Inbox polling, errors, and cancelled loads.
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AuthContext from "../AuthContext";
import { api } from "../api";
import { useInbox } from "./useInbox";

vi.mock("../api", () => ({
  api: vi.fn(),
  run: async (setError, action) => {
    setError("");
    try {
      return await action();
    } catch (err) {
      setError(err.message);
      return null;
    }
  },
}));

const user = { id: 1, username: "alex" };

function wrapper({ children }) {
  return (
    <AuthContext.Provider value={{ user }}>
      {children}
    </AuthContext.Provider>
  );
}

function ShowInbox() {
  const { threads, error, loading } = useInbox();
  if (loading) return <p>Loading inbox...</p>;
  return (
    <div>
      {error ? <p role="alert">{error}</p> : <p>Inbox ready</p>}
      {threads.map((thread) => (
        <p key={thread.otherId}>
          {thread.otherName}: {thread.messages.map((message) => message.body).join(" ")}
        </p>
      ))}
    </div>
  );
}

function setVisibility(state) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => state === "hidden",
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.hidden;
  delete document.visibilityState;
});

test("a later poll clears an error", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let calls = 0;
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.reject(new Error("Network down"));
    return Promise.resolve([]);
  });

  render(
    <AuthContext.Provider value={{ user }}>
      <ShowInbox />
    </AuthContext.Provider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Network down");

  await act(async () => {
    vi.advanceTimersByTime(20000);
  });

  expect(await screen.findByText("Inbox ready")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(calls).toBe(2);
});

test("unmount aborts the inbox fetch", async () => {
  let signal;
  api.mockImplementation((_path, _method, _body, next) => {
    signal = next;
    return new Promise(() => {});
  });

  const { unmount } = renderHook(() => useInbox(), { wrapper });
  await waitFor(() => expect(signal).toBeInstanceOf(AbortSignal));
  unmount();
  expect(signal.aborted).toBe(true);
});

test("a newer load aborts the previous fetch", async () => {
  const signals = [];
  api.mockImplementation((_path, _method, _body, signal) => {
    signals.push(signal);
    return new Promise(() => {});
  });

  const { result } = renderHook(() => useInbox(), { wrapper });
  await waitFor(() => expect(signals).toHaveLength(1));
  act(() => result.current.reload());
  await waitFor(() => expect(signals).toHaveLength(2));
  expect(signals[0].aborted).toBe(true);
  expect(signals[1].aborted).toBe(false);
});

test("becoming visible fetches immediately", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  setVisibility("visible");
  let calls = 0;
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.resolve([]);
    return Promise.resolve([{
      id: 3,
      sender_id: 2,
      recipient_id: 1,
      sender_username: "sam",
      recipient_username: "alex",
      body: "You back?",
    }]);
  });

  render(
    <AuthContext.Provider value={{ user }}>
      <ShowInbox />
    </AuthContext.Provider>,
  );
  expect(await screen.findByText("Inbox ready")).toBeInTheDocument();
  expect(calls).toBe(1);

  setVisibility("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => {
    vi.advanceTimersByTime(20000);
  });
  expect(calls).toBe(1);
  expect(screen.queryByText(/You back/)).not.toBeInTheDocument();

  setVisibility("visible");
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await screen.findByText("sam: You back?")).toBeInTheDocument();
  expect(calls).toBe(2);
});
