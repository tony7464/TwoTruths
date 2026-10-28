// Rendered cube faces: guest notes, inbox refresh, and the positions the scene uses.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FiberProvider } from "its-fine";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import AuthContext from "../AuthContext";
import { api } from "../api";
import {
  InboxFace,
  PlayersFace,
  ProfileFace,
  StatementsFace,
} from "./CubeFaces";
import Cube from "./Cube";
import { FACE_LAYOUT } from "./cubeLayout";
import { GameProvider } from "./gameContext";

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

vi.mock("@react-three/drei", () => ({
  Html: ({ position, rotation, children }) => (
    <div
      data-testid="cube-face"
      data-position={JSON.stringify(position)}
      data-rotation={JSON.stringify(rotation)}
    >
      {children}
    </div>
  ),
  useGLTF: Object.assign(() => ({}), {
    preload() {},
    setDecoderPath() {},
  }),
}));

vi.mock("@react-three/fiber", () => {
  const state = {};
  return {
    useFrame: () => {},
    useThree: (selector) => {
      if (!state.gl) {
        state.gl = { domElement: document.createElement("canvas") };
        state.camera = {
          projectionMatrix: { elements: new Array(16).fill(0) },
          matrixWorldInverse: { elements: new Array(16).fill(0) },
          position: { distanceTo: () => 5 },
          far: 1000,
          near: 0.1,
          updateMatrixWorld() {},
        };
        state.size = { width: 600, height: 600 };
        state.events = {};
      }
      return typeof selector === "function" ? selector(state) : state;
    },
  };
});

vi.mock("./cubeModel", () => ({
  useCubeModel: () => ({
    scene: {
      clone() {
        return {
          traverse(visit) {
            for (const name of ["Cube_Frame", "Face_Front", "Face_Back", "Face_Left", "Face_Right", "Eye_L", "Eye_R"]) {
              visit({ name });
            }
          },
        };
      },
    },
  }),
}));

const user = { id: 1, username: "alex", score: 2 };
const jordan = {
  id: 2,
  username: "jordan",
  my_guess: { messaging_unlocked: true },
};
const sentMessage = {
  id: 7,
  sender_id: 1,
  recipient_id: 2,
  sender_username: "alex",
  recipient_username: "jordan",
  body: "Nice lie",
};
const incoming = {
  id: 8,
  sender_id: 3,
  recipient_id: 1,
  sender_username: "sam",
  recipient_username: "alex",
  body: "Your turn",
};

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.hidden;
});

function faceValue({
  profile = jordan,
  activeFace = "right",
  sendMessage = vi.fn(),
  loggedIn = true,
} = {}) {
  return {
    loggedIn,
    anim: {
      activeFace,
      locked: false,
      inboxOpacity: 1,
      bind: vi.fn(),
      setCamera: vi.fn(),
      registerGroup: vi.fn(),
    },
    game: {
      current: profile,
      profiles: [],
      loading: false,
      selected: {},
      setSelected: vi.fn(),
      setDrafts: vi.fn(),
      messageDraft: () => "",
      sendMessage,
      sending: {},
      sent: {},
    },
    onGuess: vi.fn(),
    onPick: vi.fn(),
    onShowPlayers: vi.fn(),
    onLoginSuccess: vi.fn(),
    onLoginFailure: vi.fn(),
    onSignupSuccess: vi.fn(),
    onSignupFailure: vi.fn(),
    onShowLogin: vi.fn(),
    onShowSignup: vi.fn(),
  };
}

function wrap(value, node, authUser = user) {
  return (
    <FiberProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ user: authUser, login: vi.fn(), signup: vi.fn(), logout: vi.fn(), setUser: vi.fn(), refreshUser: vi.fn() }}>
          <GameProvider value={value}>{node}</GameProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    </FiberProvider>
  );
}

test("the scene places each face and shows the guest notes", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    callback();
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  render(wrap(faceValue({ profile: null, loggedIn: false, activeFace: "front" }), <Cube />, null));

  expect(await screen.findByText("Log in to build your profile")).toBeInTheDocument();
  expect(screen.getByText("Log in to see who is playing").tagName).toBe("P");
  expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  expect(screen.getByText("Sign up", { selector: "h2" })).toBeInTheDocument();

  const panels = screen.getAllByTestId("cube-face");
  expect(panels).toHaveLength(FACE_LAYOUT.length);
  FACE_LAYOUT.forEach((face, index) => {
    expect(JSON.parse(panels[index].dataset.position)).toEqual(face.position);
    expect(JSON.parse(panels[index].dataset.rotation)).toEqual(face.rotation ?? [0, 0, 0]);
  });
});

test("the profile face fits the bio, statements, and delete control", () => {
  const profileUser = {
    ...user,
    bio: "old bio",
    statements: [
      { id: 1, content: "I can juggle", is_lie: false },
      { id: 2, content: "I have a dog", is_lie: true },
      { id: 3, content: "I climbed Everest", is_lie: false },
    ],
    statements_locked: false,
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{
        user: profileUser,
        setUser: vi.fn(),
        refreshUser: vi.fn(),
        logout: vi.fn(),
      }}
      >
        <ProfileFace />
      </AuthContext.Provider>
    </MemoryRouter>,
  );

  expect(screen.getByLabelText("Bio")).toHaveValue("old bio");
  for (const paragraph of document.querySelectorAll("p")) {
    expect(paragraph.textContent).not.toContain("old bio");
  }
  expect(screen.getByLabelText("Statement 1")).toHaveValue("I can juggle");
  expect(screen.getByLabelText("Statement 2")).toHaveValue("I have a dog");
  expect(screen.getByLabelText("Statement 3")).toHaveValue("I climbed Everest");
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  expect(screen.getByText("score 2")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  const password = screen.getByLabelText("Password");
  expect(password).toBeRequired();
  expect(password).toHaveAttribute("minLength", "6");
  expect(password).toHaveAttribute("maxLength", "72");
  expect(screen.getByRole("button", { name: "Yes, delete everything" })).toBeInTheDocument();
});

test("the statements face lists sentences and the guess button", () => {
  const value = faceValue({
    profile: {
      id: 2,
      username: "jordan",
      statements: [
        { id: 10, content: "I can juggle" },
        { id: 11, content: "I have a dog" },
        { id: 12, content: "I climbed Everest" },
      ],
      my_guess: null,
    },
  });
  render(wrap(value, <StatementsFace />));

  expect(screen.getByText("I can juggle")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Lock in guess" }));
  expect(value.onGuess).toHaveBeenCalled();
});

test("the statements face points at the players list when nobody is picked", () => {
  const value = faceValue({ profile: null });
  render(wrap(value, <StatementsFace />));

  expect(screen.getByText("Pick someone from the Players face")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show players" }));
  expect(value.onShowPlayers).toHaveBeenCalled();
});

test("the players face lists who is playing", () => {
  const value = faceValue({ profile: null });
  value.game.profiles = [{ id: 4, username: "sam", score: 2, my_guess: null }];
  render(wrap(value, <PlayersFace />));

  expect(screen.getByText("sam")).toBeInTheDocument();
  expect(screen.getByText("not yet")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /sam/ }));
  expect(value.onPick).toHaveBeenCalledWith(4);
});

test("a locked inbox explains how to open messaging", async () => {
  render(wrap(faceValue({
    profile: { id: 2, username: "jordan", my_guess: null },
  }), <InboxFace />));

  expect(await screen.findByText("Guess someone correctly to unlock messaging")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
});

test("an unlocked inbox offers the first message", async () => {
  render(wrap(faceValue(), <InboxFace />));

  expect(await screen.findByText("Correct. Send the first message.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Message to jordan" })).toHaveAttribute("maxLength", "500");
});

test("sending a message shows the thread", async () => {
  let calls = 0;
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.resolve([]);
    return Promise.resolve([sentMessage]);
  });
  const sendMessage = vi.fn(() => Promise.resolve(sentMessage));
  render(wrap(faceValue({ sendMessage }), <InboxFace />));

  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));

  expect(await screen.findByRole("heading", { name: "jordan" })).toBeInTheDocument();
  expect(screen.getByText("Nice lie")).toBeInTheDocument();
  expect(screen.queryByText(/No messages yet/)).not.toBeInTheDocument();
  expect(sendMessage).toHaveBeenCalled();
});

test("a poll tick brings in a message from someone else", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let calls = 0;
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.resolve([]);
    return Promise.resolve([incoming]);
  });
  render(wrap(faceValue(), <InboxFace />));

  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  expect(calls).toBe(1);

  await act(async () => {
    vi.advanceTimersByTime(20000);
  });

  expect(await screen.findByRole("heading", { name: "sam" })).toBeInTheDocument();
  expect(screen.getByText("Your turn")).toBeInTheDocument();
  expect(calls).toBe(2);
});

test("opening the inbox shows a message that arrived while it was hidden", async () => {
  let calls = 0;
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.resolve([]);
    return Promise.resolve([incoming]);
  });
  const view = render(wrap(faceValue({ activeFace: "front" }), <InboxFace />));
  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  expect(calls).toBe(1);

  view.rerender(wrap(faceValue({ activeFace: "right" }), <InboxFace />));

  expect(await screen.findByRole("heading", { name: "sam" })).toBeInTheDocument();
  expect(screen.getByText("Your turn")).toBeInTheDocument();
});

test("a reload does not flash the loading text", async () => {
  let calls = 0;
  let finishSecond = () => {};
  api.mockImplementation(() => {
    calls += 1;
    if (calls === 1) return Promise.resolve([]);
    return new Promise((resolve) => {
      finishSecond = () => resolve([]);
    });
  });
  const sendMessage = vi.fn(() => Promise.resolve(sentMessage));
  render(wrap(faceValue({ sendMessage }), <InboxFace />));

  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(calls).toBe(2));
  expect(screen.queryByText("Loading inbox...")).not.toBeInTheDocument();
  expect(screen.getByText(/No messages yet/)).toBeInTheDocument();

  await act(async () => {
    finishSecond();
  });
});

test("timers are cleaned up on unmount", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  api.mockResolvedValue([]);
  const view = render(wrap(faceValue(), <InboxFace />));
  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  const calls = api.mock.calls.length;

  view.unmount();
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });

  expect(api.mock.calls.length).toBe(calls);
});

test("hiding the tab stops the inbox poll", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  api.mockResolvedValue([]);
  render(wrap(faceValue(), <InboxFace />));
  expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  const calls = api.mock.calls.length;

  Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });

  expect(api.mock.calls.length).toBe(calls);
});

function unmountWarnings(spy) {
  return spy.mock.calls
    .map((call) => call.map(String).join(" "))
    .filter((line) => line.includes("synchronously unmount"));
}

function mountFacesNow() {
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
}

async function settleRoots() {
  await act(async () => {
    await new Promise((resolve) => queueMicrotask(resolve));
  });
}

test("login keeps the face panels mounted and does not unmount a root during render", async () => {
  mountFacesNow();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(wrap(faceValue({ profile: null, loggedIn: false, activeFace: "front" }), <Cube />, null));
  const panels = await screen.findAllByTestId("cube-face");
  expect(panels).toHaveLength(4);

  view.rerender(wrap(faceValue({ profile: null, loggedIn: true, activeFace: "front" }), <Cube />, user));

  const next = screen.getAllByTestId("cube-face");
  expect(next).toHaveLength(4);
  next.forEach((panel, index) => expect(panel).toBe(panels[index]));
  expect(unmountWarnings(spy)).toEqual([]);
  view.unmount();
  await settleRoots();
  expect(unmountWarnings(spy)).toEqual([]);
  spy.mockRestore();
});

test("logout keeps the face panels mounted and does not unmount a root during render", async () => {
  mountFacesNow();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(wrap(faceValue({ profile: null, loggedIn: true, activeFace: "front" }), <Cube />, user));
  const panels = await screen.findAllByTestId("cube-face");

  view.rerender(wrap(faceValue({ profile: null, loggedIn: false, activeFace: "front" }), <Cube />, null));

  const next = screen.getAllByTestId("cube-face");
  next.forEach((panel, index) => expect(panel).toBe(panels[index]));
  expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  expect(unmountWarnings(spy)).toEqual([]);
  view.unmount();
  await settleRoots();
  expect(unmountWarnings(spy)).toEqual([]);
  spy.mockRestore();
});

test("changing faces keeps the face panels mounted and does not unmount a root during render", async () => {
  mountFacesNow();
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const view = render(wrap(faceValue({ profile: null, loggedIn: false, activeFace: "front" }), <Cube />, null));
  const panels = await screen.findAllByTestId("cube-face");

  view.rerender(wrap(faceValue({ profile: null, loggedIn: false, activeFace: "right" }), <Cube />, null));

  const next = screen.getAllByTestId("cube-face");
  next.forEach((panel, index) => expect(panel).toBe(panels[index]));
  expect(screen.getByRole("heading", { name: "Sign up" })).toBeInTheDocument();
  expect(unmountWarnings(spy)).toEqual([]);
  view.unmount();
  await settleRoots();
  expect(unmountWarnings(spy)).toEqual([]);
  spy.mockRestore();
});
