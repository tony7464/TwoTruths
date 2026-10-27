// Slam ease overshoots, and face turns take the short way around.
import { describe, expect, test } from "vitest";
import { faceYaw, shortestYaw, slamEase } from "./cubeMath";

describe("slamEase", () => {
  test("starts at 0, ends at 1, and overshoots in between", () => {
    expect(slamEase(0)).toBe(0);
    expect(slamEase(1)).toBe(1);

    let overshoot = 0;
    for (let step = 1; step < 40; step += 1) {
      overshoot = Math.max(overshoot, slamEase(step / 40));
    }
    expect(overshoot).toBeGreaterThan(1);
  });
});

describe("face yaw", () => {
  test("maps each face so it points at the camera", () => {
    expect(faceYaw("front")).toBe(0);
    expect(faceYaw("right")).toBeCloseTo(-Math.PI / 2);
    expect(faceYaw("back")).toBeCloseTo(Math.PI);
    expect(faceYaw("left")).toBeCloseTo(Math.PI / 2);
  });

  test("picks the shortest turn, including a 90 degree turn to the right", () => {
    expect(shortestYaw(0, faceYaw("right"))).toBeCloseTo(-Math.PI / 2);
    expect(shortestYaw(0, faceYaw("left"))).toBeCloseTo(Math.PI / 2);
    expect(shortestYaw(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.1);
    expect(shortestYaw(0, Math.PI)).toBeCloseTo(Math.PI);
  });
});
