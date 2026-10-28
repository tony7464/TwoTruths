// Face buttons and the switch to the flat pages.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, test, vi } from "vitest";
import AuthContext from "../AuthContext";
import CubeModeApp from "./CubeModeApp";
import { CubeFallbackContext } from "./useCubeMode";

vi.mock("./CubeScene", () => ({
  default: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderApp(user) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ user, logout: vi.fn(), loading: false }}>
        <CubeFallbackContext.Provider value={{ chooseFlat: vi.fn(), shortMotion: false }}>
          <CubeModeApp />
        </CubeFallbackContext.Provider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

test("logged-out cube controls name the faces and the flat view", () => {
  renderApp(null);

  expect(screen.getByRole("button", { name: "Log in face" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign up face" })).toBeInTheDocument();
  const flat = screen.getByRole("button", { name: "Use flat view" });
  expect(flat.className).toMatch(/focus-visible/);
});

test("signed-in cube controls name each face", () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => "[]",
  })));
  renderApp({
    id: 1,
    username: "alex",
    score: 3,
    statements: [],
    statements_locked: false,
  });

  expect(screen.getByRole("button", { name: "Statements face" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Profile face" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Players face" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Inbox face" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Use flat view" }).className).toMatch(/focus-visible/);
});
