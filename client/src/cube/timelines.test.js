// Finished animations land on the right face and clear the eye mood.
import { expect, test } from "vitest";
import {
  addSlam,
  createAuthFailTimeline,
  createAuthSuccessTimeline,
  createCorrectTimeline,
  createQuickTurnTimeline,
  createSlamTimeline,
  createWrongTimeline,
  setMood,
} from "./timelines";

function makeGroup(yaw = 0) {
  return {
    rotation: { x: 0, y: yaw, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function makeEye() {
  return {
    morphTargetDictionary: {
      Blink: 0,
      Happy: 1,
      Sad_Disapproval: 2,
      Angry: 3,
      Surprised: 4,
      LookLeft: 5,
      LookRight: 6,
    },
    morphTargetInfluences: [0, 0, 0, 0, 0, 0, 0],
  };
}

test("setMood turns on one eye shape and clears the others", () => {
  const eyes = [makeEye(), makeEye()];
  eyes[0].morphTargetInfluences[2] = 1;
  setMood(eyes, "Happy");
  expect(eyes[0].morphTargetInfluences[1]).toBe(1);
  expect(eyes[0].morphTargetInfluences[2]).toBe(0);
  expect(eyes[1].morphTargetInfluences[1]).toBe(1);
});

test("addSlam aims the group the short way around", () => {
  const group = makeGroup(0);
  const calls = [];
  const timeline = {
    to(target, vars) {
      calls.push({ target, vars });
      return this;
    },
  };
  addSlam(timeline, group, "left");
  expect(calls).toHaveLength(1);
  expect(calls[0].target).toBe(group.rotation);
  expect(calls[0].vars.y()).toBeCloseTo(Math.PI / 2);
  expect(calls[0].vars.duration).toBe(0.7);
});

test("slam to the left face uses the short turn", () => {
  const group = makeGroup(0);
  const tl = createSlamTimeline(group, "left");
  tl.progress(1);
  expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
  tl.kill();
});

test("a wrong guess ends facing the player list with the mood cleared", () => {
  const group = makeGroup(0);
  const eyes = [makeEye(), makeEye()];
  let face = "front";
  const tl = createWrongTimeline(group, eyes, () => {
    face = "left";
  });
  tl.progress(1);
  expect(face).toBe("left");
  expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
  expect(group.rotation.z).toBeCloseTo(0);
  expect(eyes[0].morphTargetInfluences[2]).toBe(0);
  expect(eyes[1].morphTargetInfluences[2]).toBe(0);
  tl.kill();
});

test("a correct guess ends on the inbox face", () => {
  const group = makeGroup(0);
  const eyes = [makeEye(), makeEye()];
  const camera = { position: { x: 0, y: 0.15, z: 6.2 } };
  const opacity = { value: 0 };
  let face = "front";
  const tl = createCorrectTimeline({
    group,
    eyes,
    camera,
    opacity,
    onSpinStart: () => {
      face = "right";
    },
    onSpinEnd: () => {},
    onOpacity: () => {},
  });
  tl.progress(1);
  expect(face).toBe("right");
  expect(group.rotation.y).toBeCloseTo(-Math.PI / 2);
  expect(opacity.value).toBeCloseTo(1);
  expect(eyes[0].morphTargetInfluences[1]).toBe(0);
  expect(group.position.y).toBeCloseTo(0);
  expect(group.scale.y).toBeCloseTo(1);
  tl.kill();
});

test("a failed login ends settled after the shake", () => {
  const group = makeGroup(0);
  const eyes = [makeEye(), makeEye()];
  const tl = createAuthFailTimeline(group, eyes);
  tl.progress(1);
  expect(group.rotation.z).toBeCloseTo(0);
  expect(group.position.x).toBeCloseTo(0);
  expect(eyes[0].morphTargetInfluences[2]).toBe(0);
  tl.kill();
});

test("a successful login ends on the front face", () => {
  const group = makeGroup(-Math.PI / 2);
  const eyes = [makeEye(), makeEye()];
  const tl = createAuthSuccessTimeline(group, eyes, () => {});
  tl.progress(1);
  expect(group.rotation.y).toBeCloseTo(0);
  expect(group.position.y).toBeCloseTo(0);
  expect(eyes[0].morphTargetInfluences[1]).toBe(0);
  tl.kill();
});

test("a quick turn does not jump or shake", () => {
  const group = makeGroup(0);
  const eyes = [makeEye(), makeEye()];
  const tl = createQuickTurnTimeline(group, "right", eyes);
  tl.progress(1);
  expect(group.rotation.y).toBeCloseTo(-Math.PI / 2);
  expect(group.position.y).toBe(0);
  expect(group.rotation.z).toBe(0);
  tl.kill();
});
