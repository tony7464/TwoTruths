// Decides cube vs flat in one place: WebGL, load errors, saved choice, motion, and screen size.
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const STAGE_BACKGROUND = "linear-gradient(180deg, #d7eefb 0%, #e6e2fb 55%, #fbf9ff 100%)";

export const CubeFallbackContext = createContext(null);

export function useCubeFallback() {
  return useContext(CubeFallbackContext);
}

export const STORAGE_KEY = "twotruths-cube-view";
export const OPT_IN_KEY = "twotruths-cube-opt-in";
export const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const NARROW_QUERY = "(max-width: 640px)";
export const COARSE_QUERY = "(pointer: coarse)";

const PREFIX = "3D view is off because ";
export const CONTEXT_LOST_REASON = "3D view stopped because the browser lost the graphics context. Reload the page to try 3D again.";

export function bindContextLoss(canvas, onLost) {
  function onContextLost(event) {
    // three.js asks us to cancel the event so the canvas does not go blank.
    event.preventDefault();
    onLost(CONTEXT_LOST_REASON);
  }
  canvas.addEventListener("webglcontextlost", onContextLost);
  return () => canvas.removeEventListener("webglcontextlost", onContextLost);
}

// The face panels use their own React root. Drop them one frame before the
// canvas goes away, or React warns that a root unmounted during render.
export function useHtmlReady(canvas, reportContextLost) {
  const [htmlReady, setHtmlReady] = useState(true);
  const reportRef = useRef(reportContextLost);

  useEffect(() => {
    reportRef.current = reportContextLost;
  });

  useEffect(() => {
    if (!canvas) return undefined;
    let frame = 0;
    let alive = true;
    const stop = bindContextLoss(canvas, () => {
      setHtmlReady(false);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!alive) return;
        reportRef.current?.();
      });
    });
    return () => {
      alive = false;
      stop();
      cancelAnimationFrame(frame);
    };
  }, [canvas]);

  return htmlReady;
}

// The canvas stays up for one frame after the cube is dismissed so face panels
// can leave first. Unmounting both in the same commit drops their roots mid-render.
export function useDeferredCanvas(wantCube) {
  const [canvasMounted, setCanvasMounted] = useState(wantCube);
  if (wantCube && !canvasMounted) {
    setCanvasMounted(true);
  }

  useEffect(() => {
    if (wantCube) return undefined;
    const frame = requestAnimationFrame(() => setCanvasMounted(false));
    return () => cancelAnimationFrame(frame);
  }, [wantCube]);

  return canvasMounted;
}

function webglAvailable() {
  // A few browsers throw from getContext instead of returning null.
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function matches(query) {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query).matches;
}

function readEnvironment() {
  return {
    reducedMotion: matches(MOTION_QUERY),
    narrow: matches(NARROW_QUERY),
    coarse: matches(COARSE_QUERY),
    webgl: webglAvailable(),
  };
}

// Private browsing can throw when storage is blocked. Treat that as no saved choice.
function readKey(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The choice still applies for this visit.
  }
}

function readStoredView() {
  return readKey(STORAGE_KEY);
}

function readOptIn() {
  return readKey(OPT_IN_KEY) === "1";
}

function constrained(input) {
  return Boolean(input.reducedMotion || input.narrow || input.coarse);
}

function resolveCubeMode(input) {
  // No WebGL, a lost context, and a failed load stay flat. A saved "flat" choice wins over opt-in.
  if (input.contextLost || !input.webgl || input.loadFailed) return "flat";
  if (input.storedView === "flat") return "flat";
  if (constrained(input) && !input.optIn) return "flat";
  return "cube";
}

export function flatReasonText(input) {
  if (input.contextLost) return CONTEXT_LOST_REASON;
  if (input.loadFailed) {
    return `${PREFIX}the cube failed to load: ${input.loadError || "unknown error"}`;
  }
  if (!input.webgl) return `${PREFIX}WebGL is not available`;
  if (input.storedView === "flat") return `${PREFIX}you chose the flat view`;
  if (input.reducedMotion) return `${PREFIX}your system has reduced motion enabled`;
  if (input.narrow || input.coarse) return `${PREFIX}this screen is narrow or touch`;
  return "";
}

function canOfferOptIn(input) {
  if (input.contextLost || !input.webgl || input.loadFailed || input.storedView === "flat") return false;
  return constrained(input);
}

export function useCubeMode(loadFailed = false, loadError = "") {
  const [env, setEnv] = useState(readEnvironment);
  const [storedView, setStoredView] = useState(readStoredView);
  const [optIn, setOptIn] = useState(readOptIn);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const queries = [MOTION_QUERY, NARROW_QUERY, COARSE_QUERY].map((query) => window.matchMedia(query));
    const update = () => setEnv(readEnvironment());
    for (const query of queries) query.addEventListener("change", update);
    return () => {
      for (const query of queries) query.removeEventListener("change", update);
    };
  }, []);

  const input = { ...env, loadFailed, loadError, storedView, optIn, contextLost };
  const mode = resolveCubeMode(input);
  const reason = mode === "flat" ? flatReasonText(input) : "";
  const offerOptIn = mode === "flat" && canOfferOptIn(input);
  const canChooseCube = mode === "flat" && env.webgl && !loadFailed && !contextLost && storedView === "flat";
  const shortMotion = mode === "cube" && env.reducedMotion;

  function chooseFlat() {
    writeKey(STORAGE_KEY, "flat");
    setStoredView("flat");
  }

  function chooseCube() {
    writeKey(STORAGE_KEY, "cube");
    setStoredView("cube");
    if (constrained(env)) {
      writeKey(OPT_IN_KEY, "1");
      setOptIn(true);
    }
  }

  function optIntoCube() {
    writeKey(OPT_IN_KEY, "1");
    writeKey(STORAGE_KEY, "cube");
    setOptIn(true);
    setStoredView("cube");
  }

  function reportContextLost() {
    setContextLost(true);
  }

  return {
    mode,
    reason,
    offerOptIn,
    canChooseCube,
    shortMotion,
    chooseFlat,
    chooseCube,
    optIntoCube,
    reportContextLost,
  };
}
