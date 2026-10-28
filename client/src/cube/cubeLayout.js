// Where each HTML panel sits on the cube. Cube.jsx fills in the words.
const PANEL = "474px";
const FRONT_H = "280px";

export const FACE_LAYOUT = [
  { id: "front", position: [0, -0.36, 0.975], width: PANEL, height: FRONT_H },
  {
    id: "back",
    position: [0, 0, -0.975],
    rotation: [0, Math.PI, 0],
    width: PANEL,
    height: PANEL,
  },
  {
    id: "left",
    position: [-0.975, 0, 0],
    rotation: [0, -Math.PI / 2, 0],
    width: PANEL,
    height: PANEL,
  },
  {
    id: "right",
    position: [0.975, 0, 0],
    rotation: [0, Math.PI / 2, 0],
    width: PANEL,
    height: PANEL,
  },
];
