// Even cube stage sizes for the viewports that used to clip the login panel.
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { cubeFrameLayout, cubeFrameSize } from "./cubeFrame";
import { useCubeFrame } from "./useCubeFrame";

const viewports = [
  [1366, 768, 598],
  [1024, 768, 598],
  [1536, 864, 672],
  [1280, 720, 560],
  [1280, 800, 624],
  [1400, 1000, 720],
  [1024, 700, 546],
  [1024, 800, 624],
  [200, 180, 140],
];

afterEach(() => {
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

test("cube frames are whole even pixels at common laptop sizes", () => {
  for (const [width, height, expected] of viewports) {
    const size = cubeFrameSize(width, height, width);
    expect(size).toBe(expected);
    expect(Number.isInteger(size)).toBe(true);
    expect(size % 2).toBe(0);
  }
});

test("a narrow container rounds down to an even width and stays centered on a whole pixel", () => {
  expect(cubeFrameSize(800, 1000, 101)).toBe(100);
  const layout = cubeFrameLayout(1366, 768, 1000);
  expect(layout.size).toBe(598);
  expect(layout.offset).toBe(201);
  expect(Number.isInteger(layout.offset)).toBe(true);
  expect(layout.offset + layout.size).toBeLessThanOrEqual(1000);
});

test("the resize hook follows the viewport with even sizes", () => {
  window.innerWidth = 1366;
  window.innerHeight = 768;
  const ref = { current: null };
  const hook = renderHook(() => useCubeFrame(ref));
  expect(hook.result.current.size).toBe(598);
  expect(hook.result.current.size % 2).toBe(0);

  act(() => {
    window.innerWidth = 1280;
    window.innerHeight = 800;
    window.dispatchEvent(new Event("resize"));
  });
  expect(hook.result.current.size).toBe(624);
  expect(hook.result.current.offset % 1).toBe(0);
});
