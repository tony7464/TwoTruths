// Both eyes share a morph, and a blink does not stack on a full happy.
import { expect, test } from "vitest";
import { setBlink, setEyeMorph } from "./eyes";

function makeEye(happyIndex = 1) {
  return {
    morphTargetDictionary: {
      Blink: 0,
      Happy: happyIndex,
      Sad_Disapproval: 2,
      LookLeft: 5,
      LookRight: 6,
    },
    morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0],
  };
}

test("sets the same morph influence on both eyes by name", () => {
  const left = makeEye(4);
  const right = makeEye(4);
  setEyeMorph([left, right], "Happy", 0.6);
  expect(left.morphTargetInfluences[4]).toBe(0.6);
  expect(right.morphTargetInfluences[4]).toBe(0.6);
  expect(left.morphTargetInfluences[0]).toBe(0);
});

test("does not stack a blink on top of a full happy", () => {
  const left = makeEye();
  const right = makeEye();
  setEyeMorph([left, right], "Happy", 1);
  setBlink([left, right], 1);
  expect(left.morphTargetInfluences[0]).toBe(0);
  expect(right.morphTargetInfluences[0]).toBe(0);
});
