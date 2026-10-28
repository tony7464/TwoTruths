// Cleans the DOM after each test and loads the jest-dom matchers.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// jsdom has no animation frames. A lost graphics context waits one frame
// before the flat view, so tests need the callback a browser would run.
if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(0), 0);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
}

afterEach(() => {
  cleanup();
});
