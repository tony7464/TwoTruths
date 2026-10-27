// Loads the Draco-compressed cube. CubeScene preloads it; Cube clones it.
import { useGLTF } from "@react-three/drei";

export const CUBE_URL = "/models/cube_v2.glb";

useGLTF.setDecoderPath("/draco/");

export function useCubeModel() {
  return useGLTF(CUBE_URL, true, false);
}
