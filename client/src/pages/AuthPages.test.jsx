import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import AuthContext from "../useAuth";
import LoginPage from "./LoginPage";
import SignupPage from "./SignupPage";

function signedOut() {
  return {
    user: null,
    loading: false,
    login: vi.fn(),
    signup: vi.fn(),
  };
}

test("the flat login page still renders", () => {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={signedOut()}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Two Truths" })).toBeInTheDocument();
  expect(screen.getByLabelText("Username")).toBeInTheDocument();
  expect(screen.getByLabelText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Create an account" })).toBeInTheDocument();
});

test("the flat signup page still renders", () => {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={signedOut()}>
        <SignupPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Create your profile" })).toBeInTheDocument();
  expect(screen.getByLabelText(/Bio/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
});
