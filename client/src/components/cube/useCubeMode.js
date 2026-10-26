import { useEffect, useState } from "react";

export const STORAGE_KEY = "twotruths-cube-view";
export const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
export const NARROW_QUERY = "(max-width: 640px)";
export const COARSE_QUERY = "(pointer: coarse)";

export function webglAvailable() {
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

export function readEnvironment() {
  return {
    reducedMotion: matches(MOTION_QUERY),
    narrow: matches(NARROW_QUERY),
    coarse: matches(COARSE_QUERY),
    webgl: webglAvailable(),
  };
}

export function readStoredView() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function resolveCubeMode({ reducedMotion, narrow, coarse, webgl, loadFailed, storedView }) {
  if (reducedMotion || narrow || coarse || !webgl || loadFailed || storedView === "flat") {
    return "flat";
  }
  return "cube";
}

export function useCubeMode(loadFailed = false) {
  const [env, setEnv] = useState(readEnvironment);
  const [storedView, setStoredView] = useState(readStoredView);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const queries = [MOTION_QUERY, NARROW_QUERY, COARSE_QUERY].map((query) => window.matchMedia(query));
    const update = () => setEnv(readEnvironment());
    for (const query of queries) query.addEventListener("change", update);
    return () => {
      for (const query of queries) query.removeEventListener("change", update);
    };
  }, []);

  const supported = !env.reducedMotion && !env.narrow && !env.coarse && env.webgl && !loadFailed;
  const mode = resolveCubeMode({ ...env, loadFailed, storedView });

  function chooseFlat() {
    localStorage.setItem(STORAGE_KEY, "flat");
    setStoredView("flat");
  }

  function chooseCube() {
    localStorage.setItem(STORAGE_KEY, "cube");
    setStoredView("cube");
  }

  return { mode, supported, chooseFlat, chooseCube };
}
