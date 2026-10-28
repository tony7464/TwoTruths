// Roles, labels, and the flat-mode buttons.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import AuthContext from "./AuthContext";
import { LoginForm, SignupForm } from "./components/AuthForms";
import ErrorNote from "./components/ErrorNote";
import FlatModeNote from "./components/FlatModeNote";
import { CubeFallbackContext } from "./cube/useCubeMode";

const auth = { user: null, login: vi.fn(), signup: vi.fn() };

function renderNote(fallback) {
  return render(
    <CubeFallbackContext.Provider value={fallback}>
      <FlatModeNote />
    </CubeFallbackContext.Provider>,
  );
}

test("errors use an alert role", () => {
  render(<ErrorNote message="Nope" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Nope");
});

test("login fields are labeled and limited", () => {
  render(
    <AuthContext.Provider value={auth}>
      <LoginForm />
    </AuthContext.Provider>,
  );

  const username = screen.getByLabelText("Username");
  expect(username).toBeRequired();
  expect(username).toHaveAttribute("minLength", "3");
  expect(username).toHaveAttribute("maxLength", "20");
  expect(username).toHaveAttribute("pattern", "[A-Za-z0-9_]{3,20}");
  expect(username).toHaveAttribute("title", "3 to 20 letters, numbers, or underscores");

  const password = screen.getByLabelText("Password");
  expect(password).toBeRequired();
  expect(password).toHaveAttribute("minLength", "6");
  expect(password).toHaveAttribute("maxLength", "72");
  expect(password).toHaveAttribute("title", "6 to 72 characters");
});

test("signup bio is optional and limited", () => {
  render(
    <AuthContext.Provider value={auth}>
      <SignupForm />
    </AuthContext.Provider>,
  );

  const bio = screen.getByLabelText(/Bio/);
  expect(bio).toHaveAttribute("maxLength", "160");
  expect(bio).not.toBeRequired();
  expect(screen.getByLabelText("Username")).toBeRequired();
  expect(screen.getByLabelText("Password")).toBeRequired();
});

test("flat mode names the opt-in button and keeps reload off", () => {
  renderNote({
    reason: "3D view is off because this screen is narrow or touch",
    offerOptIn: true,
    canChooseCube: false,
    optIntoCube: vi.fn(),
  });

  const anyway = screen.getByRole("button", { name: "Show 3D cube anyway" });
  expect(anyway.className).toMatch(/focus-visible/);
  expect(screen.queryByRole("button", { name: "Reload page" })).not.toBeInTheDocument();
});

test("a saved flat choice offers the 3D cube", () => {
  renderNote({
    reason: "3D view is off because you chose the flat view",
    offerOptIn: false,
    canChooseCube: true,
    chooseCube: vi.fn(),
  });

  const cube = screen.getByRole("button", { name: "Use 3D cube" });
  expect(cube.className).toMatch(/focus-visible/);
  expect(screen.queryByRole("button", { name: "Reload page" })).not.toBeInTheDocument();
});

test("context loss offers a reload button", () => {
  renderNote({
    reason: "3D view stopped because the browser lost the graphics context. Reload the page to try 3D again.",
    offerOptIn: false,
    canChooseCube: false,
  });

  const reload = screen.getByRole("button", { name: "Reload page" });
  expect(reload.className).toMatch(/focus-visible/);
  expect(screen.queryByRole("button", { name: "Show 3D cube anyway" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Use 3D cube" })).not.toBeInTheDocument();
});
