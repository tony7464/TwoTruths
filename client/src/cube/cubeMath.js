// Turn math: the slam ease, which way each face points, and the shortest spin.
import gsap from "gsap";

const power3In = gsap.parseEase("power3.in");

// Rush with power3.in to 105% of the turn, then an elastic settle back to 1.
// The value starts at 0, ends at 1, and passes above 1 in between.
export function slamEase(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  const rush = 0.62;
  if (t < rush) return power3In(t / rush) * 1.05;

  const u = (t - rush) / (1 - rush);
  const settled = 1.05 - 0.05 * (1 - (1 - u) * (1 - u));
  const wobble = Math.sin(u * Math.PI * 2.2) * Math.exp(-3 * u) * 0.035;
  return settled + wobble;
}

// Y rotation that points the named face at a camera sitting on +Z.
const FACE_YAW = {
  front: 0,
  right: -Math.PI / 2,
  back: Math.PI,
  left: Math.PI / 2,
};

export function faceYaw(face) {
  return FACE_YAW[face];
}

// Map the turn onto (-PI, PI] so the cube takes the short way around Y.
// An exact half-turn stays positive (destination = current + PI).
export function shortestYaw(current, target) {
  const tau = Math.PI * 2;
  let delta = target - current;
  delta = ((delta % tau) + tau) % tau;
  if (delta > Math.PI) delta -= tau;
  return current + delta;
}
