import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  COARSE_QUERY,
  MOTION_QUERY,
  NARROW_QUERY,
  OPT_IN_KEY,
  STORAGE_KEY,
  flatReasonText,
  useCubeMode,
} from "./useCubeMode";

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

test("each flat cause has its own reason", () => {
  expect(flatReasonText({
    reducedMotion: true, narrow: false, coarse: false, webgl: true, loadFailed: false, storedView: null,
  })).toBe("3D view is off because your system has reduced motion enabled");
  expect(flatReasonText({
    reducedMotion: false, narrow: true, coarse: false, webgl: true, loadFailed: false, storedView: null,
  })).toBe("3D view is off because this screen is narrow or touch");
  expect(flatReasonText({
    reducedMotion: false, narrow: false, coarse: true, webgl: true, loadFailed: false, storedView: null,
  })).toBe("3D view is off because this screen is narrow or touch");
  expect(flatReasonText({
    reducedMotion: false, narrow: false, coarse: false, webgl: false, loadFailed: false, storedView: "cube",
  })).toBe("3D view is off because WebGL is not available");
  expect(flatReasonText({
    reducedMotion: false, narrow: false, coarse: false, webgl: true, loadFailed: true, loadError: "decoder missing", storedView: null,
  })).toBe("3D view is off because the cube failed to load: decoder missing");
  expect(flatReasonText({
    reducedMotion: true, narrow: false, coarse: false, webgl: true, loadFailed: false, storedView: "flat",
  })).toBe("3D view is off because you chose the flat view");
});

test("opt-in overrides reduced motion and uses short turns", () => {
  installWebGL(true);
  installMedia({ [MOTION_QUERY]: true });
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("flat");
  expect(result.current.reason).toBe("3D view is off because your system has reduced motion enabled");
  expect(result.current.offerOptIn).toBe(true);
  expect(result.current.shortMotion).toBe(false);

  act(() => result.current.optIntoCube());
  expect(result.current.mode).toBe("cube");
  expect(result.current.shortMotion).toBe(true);
  expect(result.current.reason).toBe("");
  expect(localStorage.getItem(OPT_IN_KEY)).toBe("1");
});

test("opt-in overrides a narrow or coarse pointer", () => {
  installWebGL(true);
  installMedia({ [NARROW_QUERY]: true, [COARSE_QUERY]: true });
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.offerOptIn).toBe(true);
  act(() => result.current.optIntoCube());
  expect(result.current.mode).toBe("cube");
  expect(result.current.shortMotion).toBe(false);
});

test("webgl and load failures stay flat even with opt-in", () => {
  localStorage.setItem(OPT_IN_KEY, "1");
  installWebGL(false);
  installMedia({});
  const missing = renderHook(() => useCubeMode(false));
  expect(missing.result.current.mode).toBe("flat");
  expect(missing.result.current.offerOptIn).toBe(false);
  expect(missing.result.current.reason).toBe("3D view is off because WebGL is not available");
  missing.unmount();

  installWebGL(true);
  const failed = renderHook(() => useCubeMode(true, "glb exploded"));
  expect(failed.result.current.mode).toBe("flat");
  expect(failed.result.current.offerOptIn).toBe(false);
  expect(failed.result.current.reason).toBe("3D view is off because the cube failed to load: glb exploded");
});

test("choosing flat wins over an earlier opt-in", () => {
  installWebGL(true);
  installMedia({});
  localStorage.setItem(OPT_IN_KEY, "1");
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("cube");
  act(() => result.current.chooseFlat());
  expect(result.current.mode).toBe("flat");
  expect(result.current.reason).toBe("3D view is off because you chose the flat view");
  expect(result.current.canChooseCube).toBe(true);
  expect(result.current.offerOptIn).toBe(false);
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
