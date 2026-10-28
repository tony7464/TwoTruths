// Same CSS matrices as @react-three/drei's transform Html, so an even canvas
// keeps the panels in the place the cube faces already use.
const epsilon = (value) => (Math.abs(value) < 1e-10 ? 0 : value);

function getCSSMatrix(matrix, multipliers, prepend = "") {
  let matrix3d = "matrix3d(";
  for (let index = 0; index < 16; index += 1) {
    matrix3d += epsilon(multipliers[index] * matrix.elements[index]) + (index !== 15 ? "," : ")");
  }
  return prepend + matrix3d;
}

const cameraMultipliers = [1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1, 1, -1, 1, 1];

export function getCameraCSSMatrix(matrix) {
  return getCSSMatrix(matrix, cameraMultipliers);
}

function objectMultipliers(factor) {
  const scale = 1 / factor;
  return [
    scale, scale, scale, 1,
    -scale, -scale, -scale, -1,
    scale, scale, scale, 1,
    1, 1, 1, 1,
  ];
}

export function getObjectCSSMatrix(matrix, factor) {
  return getCSSMatrix(matrix, objectMultipliers(factor), "translate(-50%,-50%)");
}

// CSS pixels * distanceFactor / 400 = world units.
export function cssDistanceFactor(distanceFactor) {
  return 1 / ((distanceFactor || 10) / 400);
}
