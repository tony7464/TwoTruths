import { createContext, useContext } from "react";

export const CubeFallbackContext = createContext(null);

export function useCubeFallback() {
  return useContext(CubeFallbackContext);
}
