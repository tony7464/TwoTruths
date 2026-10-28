// A lost WebGL context drops the cube and offers a reload.
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import FlatModeNote from "../components/FlatModeNote";
import CubeScene from "./CubeScene";
import { GameProvider } from "./gameContext";
import { CubeFallbackContext, useCubeMode } from "./useCubeMode";

vi.mock("@react-three/drei", () => {
  function useGLTF() {
    return { scene: {} };
  }
  useGLTF.preload = () => {};
  useGLTF.setDecoderPath = () => {};
  return {
    useGLTF,
    ContactShadows: () => null,
    Html: ({ children }) => children,
  };
});

vi.mock("@react-three/fiber", async () => {
  const React = await import("react");
  return {
    useFrame: () => {},
    useThree: (selector) => (typeof selector === "function" ? selector({ gl: { domElement: document.createElement("canvas") } }) : {}),
    Canvas({ onCreated, children }) {
      const ref = React.useRef(null);
      const started = React.useRef(false);
      React.useEffect(() => {
        if (started.current || !ref.current) return;
        started.current = true;
        onCreated({
          gl: {
            domElement: ref.current,
            setClearColor() {},
          },
          scene: {},
          camera: { lookAt() {} },
        });
      }, [onCreated]);
      return React.createElement(
        "div",
        null,
        React.createElement("canvas", { ref }),
        children,
      );
    },
  };
});

vi.mock("./Cube", () => ({
  default: () => null,
}));

vi.mock("three", () => ({
  NoToneMapping: 0,
  SRGBColorSpace: "srgb",
  Scene: class Scene {},
  Color: class Color {},
  PMREMGenerator: class PMREMGenerator {
    fromScene() {
      return {
        texture: { dispose() {} },
        dispose() {},
      };
    }
    dispose() {}
  },
}));

function installMedia() {
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
}

function installWebGL() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((kind) => {
    if (kind !== "webgl" && kind !== "webgl2") return null;
    return { getParameter: () => 1 };
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function Harness() {
  const cube = useCubeMode(false, "");
  return (
    <CubeFallbackContext.Provider value={cube}>
      <GameProvider value={{ anim: { setCamera() {} } }}>
        {cube.mode === "cube" ? <CubeScene /> : <FlatModeNote />}
      </GameProvider>
    </CubeFallbackContext.Provider>
  );
}

test("a lost graphics context shows the fallback and a reload button", async () => {
  installWebGL();
  installMedia();

  render(<Harness />);

  const canvas = await screen.findByRole("img", { name: "Two Truths cube" });
  expect(canvas.tagName).toBe("CANVAS");

  canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

  expect(await screen.findByText(
    "3D view stopped because the browser lost the graphics context. Reload the page to try 3D again.",
  )).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reload page" })).toBeInTheDocument();
});
