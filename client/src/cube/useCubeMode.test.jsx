// Flat view for reduced motion, small screens, missing WebGL, load failure, and a saved choice.
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import {
  COARSE_QUERY,
  CONTEXT_LOST_REASON,
  MOTION_QUERY,
  NARROW_QUERY,
  OPT_IN_KEY,
  STORAGE_KEY,
  bindContextLoss,
  flatReasonText,
  useCubeMode,
  useDeferredCanvas,
  useHtmlReady,
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
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("reduced motion forces flat", () => {
  installWebGL(true);
  installMedia({ [MOTION_QUERY]: true });
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("flat");
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

test("a lost graphics context falls back to flat", () => {
  installWebGL(true);
  installMedia({});
  const { result } = renderHook(() => useCubeMode(false));
  expect(result.current.mode).toBe("cube");
  act(() => result.current.reportContextLost());
  expect(result.current.mode).toBe("flat");
  expect(result.current.reason).toBe(CONTEXT_LOST_REASON);
  expect(result.current.offerOptIn).toBe(false);
  expect(result.current.canChooseCube).toBe(false);
});

test("the context-lost handler asks for the flat view and then unsubscribes", () => {
  const canvas = document.createElement("canvas");
  const reasons = [];
  const stop = bindContextLoss(canvas, (reason) => reasons.push(reason));
  const event = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(reasons).toEqual([CONTEXT_LOST_REASON]);
  stop();
  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  expect(reasons).toEqual([CONTEXT_LOST_REASON]);
});

test("face html turns off before the flat fallback", () => {
  const queued = [];
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    nextId += 1;
    queued[nextId] = callback;
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (frameId) => {
    queued[frameId] = null;
  });
  installWebGL(true);
  installMedia({});
  const canvas = document.createElement("canvas");

  function Gate({ report }) {
    const htmlReady = useHtmlReady(canvas, report);
    return <span>{htmlReady ? "html on" : "html off"}</span>;
  }

  function Harness({ showGate }) {
    const cube = useCubeMode(false);
    return (
      <div>
        <span>{cube.mode}</span>
        {showGate ? <Gate report={cube.reportContextLost} /> : null}
      </div>
    );
  }

  const view = render(<Harness showGate />);
  expect(screen.getByText("html on")).toBeInTheDocument();
  expect(screen.getByText("cube")).toBeInTheDocument();

  act(() => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  expect(screen.getByText("html off")).toBeInTheDocument();
  expect(screen.getByText("cube")).toBeInTheDocument();

  const frame = nextId;
  act(() => {
    queued[frame]();
  });
  expect(screen.getByText("flat")).toBeInTheDocument();
  view.unmount();

  const second = render(<Harness showGate />);
  act(() => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  expect(screen.getByText("html off")).toBeInTheDocument();
  expect(screen.getByText("cube")).toBeInTheDocument();
  const pending = nextId;
  const callback = queued[pending];
  second.rerender(<Harness showGate={false} />);
  act(() => {
    callback();
  });
  expect(screen.getByText("cube")).toBeInTheDocument();
  expect(screen.queryByText("flat")).not.toBeInTheDocument();
  expect(screen.queryByText("html off")).not.toBeInTheDocument();
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

test("the canvas stays up until the frame after the cube is dismissed", () => {
  const queued = [];
  let nextId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback) => {
    nextId += 1;
    queued[nextId] = callback;
    return nextId;
  });
  vi.stubGlobal("cancelAnimationFrame", (frameId) => {
    queued[frameId] = null;
  });
  const hook = renderHook(({ want }) => useDeferredCanvas(want), {
    initialProps: { want: true },
  });
  expect(hook.result.current).toBe(true);
  hook.rerender({ want: false });
  expect(hook.result.current).toBe(true);
  act(() => {
    queued[nextId]();
  });
  expect(hook.result.current).toBe(false);
});
