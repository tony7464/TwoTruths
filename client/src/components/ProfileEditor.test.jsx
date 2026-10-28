// Bio save, statement confirm, and account delete.
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";
import AuthContext from "../AuthContext";
import { api } from "../api";
import ProfileEditor from "./ProfileEditor";
import { COMPACT_CHARS_PER_ROW, rowsForContent } from "./profileRows";

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

const user = {
  id: 1,
  username: "alex",
  bio: "old bio",
  score: 2,
  statements: [
    { id: 1, content: "I can juggle", is_lie: false },
    { id: 2, content: "I have a dog", is_lie: true },
    { id: 3, content: "I climbed Everest", is_lie: false },
  ],
  statements_locked: false,
};

beforeEach(() => {
  api.mockReset();
});

function renderEditor(extra = {}) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          user,
          setUser: extra.setUser || vi.fn(),
          logout: extra.logout || vi.fn(),
          refreshUser: extra.refreshUser || vi.fn(async () => user),
        }}
      >
        <ProfileEditor />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function DeleteHarness() {
  const [current, setCurrent] = useState(user);
  return (
    <MemoryRouter initialEntries={["/profile"]}>
      <AuthContext.Provider
        value={{
          user: current,
          setUser: vi.fn(),
          logout: async () => setCurrent(null),
          refreshUser: vi.fn(async () => current),
        }}
      >
        <p>{current ? current.username : "signed out"}</p>
        <Routes>
          <Route path="/profile" element={<ProfileEditor />} />
          <Route path="/login" element={<h1>Log in</h1>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

test("profile fields use the server limits", () => {
  renderEditor();
  const bio = screen.getByLabelText("Bio");
  expect(bio).toHaveAttribute("maxLength", "160");
  expect(bio).not.toBeRequired();
  const statement = screen.getByLabelText("Statement 1");
  expect(statement).toBeRequired();
  expect(statement).toHaveAttribute("maxLength", "200");
});

test("saving a bio updates the signed-in user", async () => {
  const setUser = vi.fn();
  api.mockImplementation((path, method, body) => {
    if (path === "/api/profile" && method === "PATCH") {
      return Promise.resolve({ ...user, bio: body.bio });
    }
    return Promise.reject(new Error(`${method} ${path}`));
  });
  renderEditor({ setUser });

  fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "New bio" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByRole("status")).toHaveTextContent("Saved.");
  expect(api).toHaveBeenCalledWith("/api/profile", "PATCH", { bio: "New bio" });
  expect(setUser).toHaveBeenCalledWith(expect.objectContaining({ bio: "New bio" }));
});

test("cancel closes account delete before anything is removed", () => {
  renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  const password = screen.getByLabelText("Password");
  expect(password).toBeRequired();
  expect(password).toHaveAttribute("minLength", "6");
  expect(password).toHaveAttribute("maxLength", "72");
  expect(screen.getByRole("button", { name: "Yes, delete everything" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete my account" })).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});

test("a wrong password shows the error and stays logged in", async () => {
  api.mockRejectedValue(new Error("Password is incorrect."));
  const logout = vi.fn();
  renderEditor({ logout });

  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Yes, delete everything" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Password is incorrect.");
  expect(logout).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Your two truths and a lie" })).toBeInTheDocument();
});

test("deleting the account clears the user and opens the login page", async () => {
  api.mockResolvedValue({ message: "Account deleted." });
  render(<DeleteHarness />);

  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Yes, delete everything" }));

  expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  expect(screen.getByText("signed out")).toBeInTheDocument();
});

test("deleting statements asks before it removes them", async () => {
  const refreshUser = vi.fn(async () => ({ ...user, statements: [] }));
  api.mockImplementation((path, method) => {
    if (path === "/api/statements" && method === "DELETE") return Promise.resolve({});
    return Promise.reject(new Error(`${method} ${path}`));
  });
  renderEditor({ refreshUser });

  fireEvent.click(screen.getByRole("button", { name: "Delete statements and start over" }));
  expect(screen.getByText("Delete all three statements and start over?")).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByText("Delete all three statements and start over?")).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Delete statements and start over" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByRole("status")).toHaveTextContent(
    "Statements deleted. Write a new set of three.",
  );
  expect(api).toHaveBeenCalledWith("/api/statements", "DELETE");
});

// jsdom does not lay out text, so scrollHeight is stubbed from the value length.
// clientHeight is the border-box height minus the 1px top and bottom borders.
// The check is that a 200-character statement and a long bio end up with
// scrollHeight <= clientHeight, and that rowsForContent / the rows attribute
// match that growth.
test("compact profile text grows to fit a long bio and a 200-character statement", () => {
  const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");
  const clientDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "clientHeight");
  const readStyle = window.getComputedStyle;
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return 40 + this.value.length;
    },
  });
  Object.defineProperty(HTMLTextAreaElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      const height = Number.parseFloat(this.style.height);
      return Number.isFinite(height) ? height - 2 : 0;
    },
  });
  window.getComputedStyle = (element) => {
    const style = readStyle(element);
    return new Proxy(style, {
      get(target, prop, receiver) {
        if (prop === "borderTopWidth" || prop === "borderBottomWidth") return "1px";
        return Reflect.get(target, prop, receiver);
      },
    });
  };

  try {
    const statement = "s".repeat(200);
    const longUser = {
      ...user,
      bio: "b".repeat(160),
      statements: [
        { id: 1, content: statement, is_lie: false },
        { id: 2, content: "I have a dog", is_lie: true },
        { id: 3, content: "I climbed Everest", is_lie: false },
      ],
    };
    render(
      <MemoryRouter>
        <AuthContext.Provider
          value={{ user: longUser, setUser: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(async () => longUser) }}
        >
          <ProfileEditor compact />
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    const bio = screen.getByLabelText("Bio");
    const field = screen.getByLabelText("Statement 1");
    const bioRows = rowsForContent("b".repeat(160), 3, COMPACT_CHARS_PER_ROW);
    const statementRows = rowsForContent(statement, 2, COMPACT_CHARS_PER_ROW);
    expect(rowsForContent("old bio", 3, COMPACT_CHARS_PER_ROW)).toBe(3);
    expect(bioRows).toBeGreaterThanOrEqual(3);
    expect(statementRows).toBeGreaterThanOrEqual(2);
    expect(bio).toHaveAttribute("rows", String(bioRows));
    expect(field).toHaveAttribute("rows", String(statementRows));
    expect(bio.scrollHeight).toBeLessThanOrEqual(bio.clientHeight);
    expect(field.scrollHeight).toBeLessThanOrEqual(field.clientHeight);

    const typed = "t".repeat(200);
    fireEvent.change(field, { target: { value: typed } });
    expect(field).toHaveAttribute("rows", String(rowsForContent(typed, 2, COMPACT_CHARS_PER_ROW)));
    expect(field.scrollHeight).toBeLessThanOrEqual(field.clientHeight);

    fireEvent.change(bio, { target: { value: "short bio" } });
    expect(bio).toHaveAttribute("rows", "3");
    expect(bio.scrollHeight).toBeLessThanOrEqual(bio.clientHeight);

    fireEvent.change(bio, { target: { value: "c".repeat(160) } });
    expect(bio).toHaveAttribute("rows", String(rowsForContent("c".repeat(160), 3, COMPACT_CHARS_PER_ROW)));
    expect(bio.scrollHeight).toBeLessThanOrEqual(bio.clientHeight);
  } finally {
    window.getComputedStyle = readStyle;
    if (scrollDescriptor) Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", scrollDescriptor);
    else delete HTMLTextAreaElement.prototype.scrollHeight;
    if (clientDescriptor) Object.defineProperty(HTMLTextAreaElement.prototype, "clientHeight", clientDescriptor);
    else delete HTMLTextAreaElement.prototype.clientHeight;
  }
});
