import gsap from "gsap";
import { faceYaw, shortestYaw, slamEase } from "./cubeMath";
import { clearMoods, setBlink, setEyeMorph } from "./eyes";

const SLAM_SECONDS = 0.7;

export function settlePose(group) {
  group.rotation.x = 0;
  group.rotation.z = 0;
  group.position.x = 0;
  group.position.y = 0;
  group.position.z = 0;
  group.scale.x = 1;
  group.scale.y = 1;
  group.scale.z = 1;
}

export function createSlamTimeline(group, face) {
  const dest = shortestYaw(group.rotation.y, faceYaw(face));
  return gsap.timeline({ paused: true }).to(group.rotation, {
    y: dest,
    duration: SLAM_SECONDS,
    ease: slamEase,
  });
}

export function createWrongTimeline(group, eyes, onSpinStart) {
  const tl = gsap.timeline({ paused: true });
  const amp = (7 * Math.PI) / 180;
  const mood = { sad: 1 };

  tl.call(() => {
    clearMoods(eyes);
    setEyeMorph(eyes, "Sad_Disapproval", 1);
  });

  for (let beat = 0; beat < 4; beat += 1) {
    const sign = beat % 2 === 0 ? 1 : -1;
    const mag = 1 - beat * 0.22;
    tl.to(group.rotation, { z: sign * amp * mag, duration: 0.2, ease: "power1.inOut" });
    tl.to(group.position, { x: sign * 0.06 * mag, duration: 0.2, ease: "power1.inOut" }, "<");
  }

  tl.to(group.rotation, { z: 0, duration: 0.16, ease: "power2.out" });
  tl.to(group.position, { x: 0, duration: 0.16, ease: "power2.out" }, "<");
  tl.to(mood, {
    sad: 0,
    duration: 0.3,
    onUpdate: () => setEyeMorph(eyes, "Sad_Disapproval", mood.sad),
  });

  // After the shake, slam the short way around to the player list on the left.
  tl.call(() => {
    setEyeMorph(eyes, "Sad_Disapproval", 0);
    onSpinStart?.();
  });
  tl.to(group.rotation, {
    y: () => shortestYaw(group.rotation.y, faceYaw("left")),
    duration: SLAM_SECONDS,
    ease: slamEase,
  });

  return tl;
}

export function createCorrectTimeline({ group, eyes, camera, opacity, onSpinStart, onSpinEnd, onOpacity }) {
  const tl = gsap.timeline({ paused: true });
  const base = { x: camera.position.x, y: camera.position.y, z: camera.position.z };

  tl.to(group.scale, { y: 0.92, x: 1.04, z: 1.04, duration: 0.16, ease: "power2.in" });

  tl.call(() => {
    clearMoods(eyes);
    setEyeMorph(eyes, "Surprised", 1);
  });
  tl.to(group.position, { y: 0.6, duration: 0.24, ease: "power2.out" });
  tl.to(group.scale, { y: 1.14, x: 0.94, z: 0.94, duration: 0.24, ease: "power2.out" }, "<");

  tl.call(() => {
    clearMoods(eyes);
    setEyeMorph(eyes, "Happy", 1);
  });
  tl.to(group.rotation, { x: 0.25, duration: 0.13, ease: "power1.inOut" });
  tl.to(group.rotation, { x: 0, duration: 0.13, ease: "power1.inOut" });
  tl.to(group.rotation, { x: 0.25, duration: 0.13, ease: "power1.inOut" });
  tl.to(group.rotation, { x: 0, duration: 0.13, ease: "power1.inOut" });

  tl.to(group.position, { y: 0, duration: 0.18, ease: "bounce.out" });
  tl.to(group.scale, { x: 1.06, y: 0.94, z: 1.06, duration: 0.08, ease: "power2.in" }, "<");
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.18, ease: "power2.out" });
  tl.set(group.rotation, { x: 0, z: 0 });

  // 90° slam onto the inbox (right face). From the front this lands on -PI/2.
  tl.call(() => onSpinStart?.());
  tl.to(group.rotation, {
    y: () => shortestYaw(group.rotation.y, faceYaw("right")),
    duration: SLAM_SECONDS,
    ease: slamEase,
  });
  tl.call(() => onSpinEnd?.());

  const kicks = [0.05, -0.035, 0.02, -0.01, 0];
  for (const kick of kicks) {
    tl.to(camera.position, {
      x: base.x + kick,
      y: base.y + kick * 0.35,
      duration: 0.05,
      ease: "power1.inOut",
    });
  }
  tl.to(camera.position, { x: base.x, y: base.y, z: base.z, duration: 0.04 });

  tl.to(opacity, {
    value: 1,
    duration: 0.4,
    ease: "power1.out",
    onUpdate: () => onOpacity?.(opacity.value),
  });
  tl.call(() => {
    opacity.value = 1;
    onOpacity?.(1);
    clearMoods(eyes);
  });

  return tl;
}

export function createAuthFailTimeline(group, eyes) {
  const tl = gsap.timeline({ paused: true });
  const amp = (7 * Math.PI) / 180;
  const mood = { sad: 1 };

  tl.call(() => {
    clearMoods(eyes);
    setEyeMorph(eyes, "Sad_Disapproval", 1);
  });

  for (let beat = 0; beat < 4; beat += 1) {
    const sign = beat % 2 === 0 ? 1 : -1;
    const mag = 1 - beat * 0.22;
    tl.to(group.rotation, { z: sign * amp * mag, duration: 0.2, ease: "power1.inOut" });
    tl.to(group.position, { x: sign * 0.06 * mag, duration: 0.2, ease: "power1.inOut" }, "<");
  }

  tl.to(group.rotation, { z: 0, duration: 0.16, ease: "power2.out" });
  tl.to(group.position, { x: 0, duration: 0.16, ease: "power2.out" }, "<");
  tl.to(mood, {
    sad: 0,
    duration: 0.3,
    onUpdate: () => setEyeMorph(eyes, "Sad_Disapproval", mood.sad),
  });
  tl.call(() => setEyeMorph(eyes, "Sad_Disapproval", 0));
  return tl;
}

export function createAuthSuccessTimeline(group, eyes, onSpinStart) {
  const tl = gsap.timeline({ paused: true });

  tl.call(() => {
    clearMoods(eyes);
    setEyeMorph(eyes, "Happy", 1);
  });
  tl.to(group.scale, { y: 0.94, x: 1.03, z: 1.03, duration: 0.12, ease: "power2.in" });
  tl.to(group.position, { y: 0.35, duration: 0.18, ease: "power2.out" });
  tl.to(group.scale, { y: 1.08, x: 0.96, z: 0.96, duration: 0.18, ease: "power2.out" }, "<");
  tl.to(group.rotation, { x: 0.18, duration: 0.1, ease: "power1.inOut" });
  tl.to(group.rotation, { x: 0, duration: 0.1, ease: "power1.inOut" });
  tl.to(group.position, { y: 0, duration: 0.16, ease: "bounce.out" });
  tl.to(group.scale, { x: 1, y: 1, z: 1, duration: 0.14, ease: "power2.out" }, "<");
  tl.set(group.rotation, { x: 0, z: 0 });
  tl.call(() => onSpinStart?.());
  tl.to(group.rotation, {
    y: () => shortestYaw(group.rotation.y, faceYaw("front")),
    duration: SLAM_SECONDS,
    ease: slamEase,
  });
  tl.call(() => clearMoods(eyes));
  return tl;
}

// Reduced motion: a short yaw turn, no jump and no shake.
export function createQuickTurnTimeline(group, face, eyes, mood) {
  const tl = gsap.timeline({ paused: true });
  tl.call(() => {
    clearMoods(eyes);
    if (mood) setEyeMorph(eyes, mood, 1);
  });
  tl.to(group.rotation, {
    y: () => shortestYaw(group.rotation.y, faceYaw(face)),
    duration: 0.22,
    ease: "power2.inOut",
  });
  tl.call(() => clearMoods(eyes));
  return tl;
}

export function createQuickMoodTimeline(eyes, mood) {
  const state = { value: 0 };
  return gsap.timeline({ paused: true })
    .call(() => clearMoods(eyes))
    .to(state, {
      value: 1,
      duration: 0.12,
      onUpdate: () => setEyeMorph(eyes, mood, state.value),
    })
    .to(state, {
      value: 0,
      duration: 0.18,
      onUpdate: () => setEyeMorph(eyes, mood, state.value),
    });
}

export function createIdleTimeline(eyes) {
  const state = { blink: 0, lookLeft: 0, lookRight: 0 };
  const tweens = [];
  let dead = false;

  const apply = () => {
    setBlink(eyes, state.blink);
    setEyeMorph(eyes, "LookLeft", state.lookLeft);
    setEyeMorph(eyes, "LookRight", state.lookRight);
  };

  const remember = (tween) => {
    tweens.push(tween);
    return tween;
  };

  function scheduleBlink() {
    if (dead) return;
    remember(gsap.delayedCall(gsap.utils.random(2, 5), () => {
      if (dead) return;
      remember(gsap.timeline({ onComplete: scheduleBlink })
        .to(state, { blink: 1, duration: 0.12, onUpdate: apply })
        .to(state, { blink: 0, duration: 0.12, onUpdate: apply }));
    }));
  }

  function scheduleLook() {
    if (dead) return;
    const key = Math.random() < 0.5 ? "lookLeft" : "lookRight";
    remember(gsap.delayedCall(gsap.utils.random(3, 6), () => {
      if (dead) return;
      state.lookLeft = 0;
      state.lookRight = 0;
      remember(gsap.timeline({ onComplete: scheduleLook })
        .to(state, { [key]: 0.6, duration: 0.35, onUpdate: apply })
        .to(state, { [key]: 0, duration: 0.35, onUpdate: apply }));
    }));
  }

  scheduleBlink();
  scheduleLook();

  const timeline = gsap.timeline({ paused: true });
  const kill = () => {
    dead = true;
    for (const tween of tweens) tween.kill();
    tweens.length = 0;
    gsap.killTweensOf(state);
    state.blink = 0;
    state.lookLeft = 0;
    state.lookRight = 0;
    apply();
    return timeline;
  };
  timeline.kill = kill;
  return timeline;
}
