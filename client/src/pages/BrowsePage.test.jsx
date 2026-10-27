// Flat browse shows profiles, and a guess is sent only by Lock in guess.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AuthContext from "../AuthContext";
import BrowsePage from "./BrowsePage";

const profile = {
  id: 2,
  username: "jordan",
  bio: "hi",
  score: 3,
  fooled_count: 1,
  statements: [
    { id: 10, content: "I can juggle" },
    { id: 11, content: "I have a dog" },
    { id: 12, content: "I climbed Everest" },
  ],
  my_guess: null,
};

function json(data, status = 200) {
  return { ok: status < 400, status, text: async () => JSON.stringify(data) };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("flat browse renders profiles and locks a guess only after Lock in guess", async () => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  const fetchMock = vi.fn(async (path, options) => {
    if (path === "/api/users") return json([profile]);
    if (path === "/api/guesses" && options?.method === "POST") {
      const body = JSON.parse(options.body);
      return json({
        is_correct: false,
        profile_score: 3,
        fooled_count: 2,
        score: 2,
        statement_id: body.statement_id,
        messaging_unlocked: false,
        lie: { id: 12, content: "I climbed Everest" },
      }, 201);
    }
    return json({ error: "missing" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);

  const user = { id: 1, username: "alex", score: 2, statements: [], statements_locked: false };
  render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), refreshUser: vi.fn() }}>
      <BrowsePage />
    </AuthContext.Provider>,
  );

  expect(await screen.findByRole("heading", { name: "jordan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "I have a dog" }));
  expect(fetchMock).not.toHaveBeenCalledWith("/api/guesses", expect.anything());

  fireEvent.click(screen.getByRole("button", { name: "Lock in guess" }));
  expect(await screen.findByText("That's your one guess. Messaging stays closed.")).toBeInTheDocument();
  expect(screen.getByText("Lie")).toBeInTheDocument();
  expect(screen.getByText("Your guess")).toBeInTheDocument();

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/guesses", expect.objectContaining({ method: "POST" }));
  });
});
