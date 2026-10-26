import { CubeFallbackContext } from "./cubeFallbackContext";

export function CubeFallbackProvider({ value, children }) {
  return (
    <CubeFallbackContext.Provider value={value}>
      {children}
    </CubeFallbackContext.Provider>
  );
}
