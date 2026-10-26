import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MOTION_QUERY, STORAGE_KEY, useCubeMode } from "./useCubeMode";

function installMedia(matches) {
  window.matchMedia = (query) => ({
    matches: Boolean(matches[query]),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

function installWebGL(available) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((kind) => {
    if (kind !== "webgl" && kind !== "webgl2") return null;
    return available ? { getParameter: () => 1 } : null;
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("reduced motion forces flat", () => {
  installWebGL(true);
  installMedia({ [MOTION_QUERY]: true });
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("flat");
  expect(result.current.supported).toBe(false);
});

test("missing WebGL forces flat even if the cube was saved", () => {
  localStorage.setItem(STORAGE_KEY, "cube");
  installWebGL(false);
  installMedia({});
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("flat");
});

test("the view toggle is saved and restored", () => {
  installWebGL(true);
  installMedia({});
  const first = renderHook(() => useCubeMode(false));
  expect(first.result.current.mode).toBe("cube");

  act(() => first.result.current.chooseFlat());
  expect(first.result.current.mode).toBe("flat");
  expect(localStorage.getItem(STORAGE_KEY)).toBe("flat");
  first.unmount();

  const second = renderHook(() => useCubeMode(false));
  expect(second.result.current.mode).toBe("flat");
  act(() => second.result.current.chooseCube());
  expect(second.result.current.mode).toBe("cube");
  expect(localStorage.getItem(STORAGE_KEY)).toBe("cube");
});

test("a matchMedia change can force flat", () => {
  let reduced = false;
  const listeners = new Set();
  installWebGL(true);
  window.matchMedia = (query) => ({
    get matches() {
      return query === MOTION_QUERY ? reduced : false;
    },
    addEventListener: (_name, fn) => listeners.add(fn),
    removeEventListener: (_name, fn) => listeners.delete(fn),
  });

  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("cube");
  reduced = true;
  act(() => {
    for (const fn of listeners) fn();
  });
  expect(result.current.mode).toBe("flat");
});
