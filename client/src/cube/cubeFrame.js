// The cube stage used to be `min(78vh, 720px)`. That length is fractional at
// 720, 768, and 864 px tall viewports. A fractional canvas makes drei-style
// face math (`width / 2` versus a 50% transform origin, and floor vs round of
// width * devicePixelRatio) shift the HTML panels left until the canvas clips them.
export const CUBE_MAX_PX = 720;
export const CUBE_VH_FRACTION = 0.78;
// `px-3` on the stage when the container has not been measured yet.
export const CUBE_GUTTER_PX = 24;

export function cubeFrameSize(viewportWidth, viewportHeight, containerWidth = viewportWidth - CUBE_GUTTER_PX) {
  const widthLimit = Math.max(0, containerWidth);
  const raw = Math.min(Math.max(0, viewportHeight) * CUBE_VH_FRACTION, CUBE_MAX_PX, widthLimit);
  return Math.floor(raw / 2) * 2;
}

export function cubeFrameLayout(viewportWidth, viewportHeight, containerWidth) {
  const available = Math.max(0, containerWidth);
  const size = cubeFrameSize(viewportWidth, viewportHeight, available);
  const offset = Math.floor((Math.max(available, size) - size) / 2);
  return { size, offset };
}

function readContainerWidth(container) {
  const measured = container?.clientWidth ?? 0;
  if (measured > 0) return measured;
  return Math.max(0, window.innerWidth - CUBE_GUTTER_PX);
}

export function readCubeFrame(container) {
  return cubeFrameLayout(window.innerWidth, window.innerHeight, readContainerWidth(container));
}
