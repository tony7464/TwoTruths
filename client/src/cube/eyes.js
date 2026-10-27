// Eye shapes on the cube model.
const MOODS = [
  "Blink",
  "Happy",
  "Sad_Disapproval",
  "Angry",
  "Surprised",
  "LookLeft",
  "LookRight",
];

export function setEyeMorph(eyes, name, value) {
  for (const eye of eyes) {
    const index = eye?.morphTargetDictionary?.[name];
    if (index === undefined || !eye.morphTargetInfluences) continue;
    eye.morphTargetInfluences[index] = value;
  }
}

function readEyeMorph(eye, name) {
  const index = eye?.morphTargetDictionary?.[name];
  if (index === undefined || !eye.morphTargetInfluences) return 0;
  return eye.morphTargetInfluences[index] ?? 0;
}

// Blink and Happy are absolute offsets, so a full blink is skipped while Happy is on.
export function setBlink(eyes, value) {
  if (value > 0 && readEyeMorph(eyes[0], "Happy") >= 0.99) return;
  setEyeMorph(eyes, "Blink", value);
}

export function clearMoods(eyes) {
  for (const name of MOODS) setEyeMorph(eyes, name, 0);
}
