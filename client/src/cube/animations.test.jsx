// playVariant guards, and the quick path versus the full path. GSAP is faked.
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

vi.mock("./timelines", () => {
  function timeline() {
    return {
      eventCallback: vi.fn(),
      play: vi.fn(),
      kill: vi.fn(),
    };
  }
  return {
    createAuthFailTimeline: vi.fn(() => timeline()),
    createAuthSuccessTimeline: vi.fn(() => timeline()),
    createCorrectTimeline: vi.fn(() => timeline()),
    createIdleTimeline: vi.fn(() => timeline()),
    createQuickMoodTimeline: vi.fn(() => timeline()),
    createQuickTurnTimeline: vi.fn(() => timeline()),
    createSlamTimeline: vi.fn(() => timeline()),
    createWrongTimeline: vi.fn(() => timeline()),
    settlePose: vi.fn(),
  };
});

import { useCubeAnimations } from "./animations";
import {
  createAuthFailTimeline,
  createAuthSuccessTimeline,
  createCorrectTimeline,
  createQuickMoodTimeline,
  createQuickTurnTimeline,
  createWrongTimeline,
} from "./timelines";

function makeGroup() {
  return {
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("a missing group records the face and does not play", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.playWrong());
  expect(result.current.activeFace).toBe("left");
  expect(result.current.playing).toBe(false);
  expect(result.current.locked).toBe(false);
  expect(createWrongTimeline).not.toHaveBeenCalled();
  expect(createQuickTurnTimeline).not.toHaveBeenCalled();
});

test("a null face does not change the current face", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.registerGroup(makeGroup()));
  act(() => result.current.playAuthFail());
  expect(result.current.activeFace).toBe("front");
  expect(result.current.playing).toBe(true);
  expect(result.current.locked).toBe(true);
  expect(createAuthFailTimeline).toHaveBeenCalled();
});

test("a busy cube ignores another turn", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.registerGroup(makeGroup()));
  act(() => result.current.setCamera({ position: { x: 0, y: 0, z: 5 } }));
  act(() => result.current.playWrong());
  expect(result.current.activeFace).toBe("left");
  expect(result.current.playing).toBe(true);
  act(() => result.current.playCorrect());
  act(() => result.current.playAuthFail());
  act(() => result.current.playAuthSuccess());
  expect(result.current.activeFace).toBe("left");
  expect(result.current.playing).toBe(true);
  expect(result.current.locked).toBe(true);
  expect(createWrongTimeline).toHaveBeenCalled();
  expect(createCorrectTimeline).not.toHaveBeenCalled();
  expect(createAuthFailTimeline).not.toHaveBeenCalled();
  expect(createAuthSuccessTimeline).not.toHaveBeenCalled();
});

test("full motion plays the long timelines", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.registerGroup(makeGroup()));
  act(() => result.current.setCamera({ position: { x: 0, y: 0, z: 5 } }));

  act(() => result.current.playWrong());
  expect(result.current.activeFace).toBe("left");
  expect(result.current.playing).toBe(true);
  expect(result.current.locked).toBe(true);
  expect(createWrongTimeline).toHaveBeenCalled();
  expect(createQuickTurnTimeline).not.toHaveBeenCalled();
});

test("a correct guess uses the long timeline when the camera is ready", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.registerGroup(makeGroup()));
  act(() => result.current.setCamera({ position: { x: 0, y: 0, z: 5 } }));
  act(() => result.current.playCorrect());
  expect(result.current.activeFace).toBe("right");
  expect(result.current.playing).toBe(true);
  expect(result.current.inboxOpacity).toBe(0);
  expect(createCorrectTimeline).toHaveBeenCalled();
  expect(createQuickTurnTimeline).not.toHaveBeenCalled();
});

test("a correct guess without a camera uses the quick turn", () => {
  const { result } = renderHook(() => useCubeAnimations("front", false));
  act(() => result.current.registerGroup(makeGroup()));
  act(() => result.current.playCorrect());
  expect(result.current.activeFace).toBe("right");
  expect(result.current.playing).toBe(true);
  expect(result.current.inboxOpacity).toBe(1);
  expect(createCorrectTimeline).not.toHaveBeenCalled();
  expect(createQuickTurnTimeline).toHaveBeenCalled();
});

test("reduced motion uses the quick branch", () => {
  const wrong = renderHook(() => useCubeAnimations("front", true));
  act(() => wrong.result.current.registerGroup(makeGroup()));
  act(() => wrong.result.current.playWrong());
  expect(wrong.result.current.activeFace).toBe("left");
  expect(wrong.result.current.playing).toBe(true);
  expect(wrong.result.current.locked).toBe(true);
  expect(createQuickTurnTimeline).toHaveBeenCalled();
  expect(createWrongTimeline).not.toHaveBeenCalled();
  wrong.unmount();
  vi.clearAllMocks();

  const correct = renderHook(() => useCubeAnimations("front", true));
  act(() => correct.result.current.registerGroup(makeGroup()));
  act(() => correct.result.current.playCorrect());
  expect(correct.result.current.activeFace).toBe("right");
  expect(correct.result.current.playing).toBe(true);
  expect(correct.result.current.inboxOpacity).toBe(1);
  expect(createQuickTurnTimeline).toHaveBeenCalled();
  expect(createCorrectTimeline).not.toHaveBeenCalled();
  correct.unmount();
  vi.clearAllMocks();

  const failed = renderHook(() => useCubeAnimations("front", true));
  act(() => failed.result.current.registerGroup(makeGroup()));
  act(() => failed.result.current.playAuthFail());
  expect(failed.result.current.activeFace).toBe("front");
  expect(failed.result.current.playing).toBe(true);
  expect(createQuickMoodTimeline).toHaveBeenCalled();
  expect(createAuthFailTimeline).not.toHaveBeenCalled();
  failed.unmount();
  vi.clearAllMocks();

  const signedIn = renderHook(() => useCubeAnimations("right", true));
  act(() => signedIn.result.current.registerGroup(makeGroup()));
  act(() => signedIn.result.current.playAuthSuccess());
  expect(signedIn.result.current.activeFace).toBe("front");
  expect(signedIn.result.current.playing).toBe(true);
  expect(createQuickTurnTimeline).toHaveBeenCalled();
  expect(createAuthSuccessTimeline).not.toHaveBeenCalled();
});

test("full motion plays the auth timelines", () => {
  const failed = renderHook(() => useCubeAnimations("front", false));
  act(() => failed.result.current.registerGroup(makeGroup()));
  act(() => failed.result.current.playAuthFail());
  expect(failed.result.current.activeFace).toBe("front");
  expect(failed.result.current.playing).toBe(true);
  expect(failed.result.current.locked).toBe(true);
  expect(createAuthFailTimeline).toHaveBeenCalled();
  expect(createQuickMoodTimeline).not.toHaveBeenCalled();
  failed.unmount();

  const signedIn = renderHook(() => useCubeAnimations("right", false));
  act(() => signedIn.result.current.registerGroup(makeGroup()));
  act(() => signedIn.result.current.playAuthSuccess());
  expect(signedIn.result.current.activeFace).toBe("front");
  expect(signedIn.result.current.playing).toBe(true);
  expect(createAuthSuccessTimeline).toHaveBeenCalled();
  expect(createQuickTurnTimeline).not.toHaveBeenCalled();
});
