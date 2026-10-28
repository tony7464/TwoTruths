// HTML panels on the cube faces. Each panel has its own React root because the
// canvas tree cannot emit DOM. Unmounting that root inside a layout effect runs
// while React is still committing, which logs "synchronously unmount a root".
// The root is dropped on a microtask, after this commit finishes.
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Vector3 } from "three";
import { cssDistanceFactor, getCameraCSSMatrix, getObjectCSSMatrix } from "./faceCss";

const DISTANCE = 1.4;
const Z_RANGE = [16777271, 0];

function releaseRoot(root, node) {
  queueMicrotask(() => {
    root.unmount();
    node.remove();
  });
}

function parentFor(gl) {
  return gl.domElement?.parentNode || document.body;
}

export function CenteredNote({ children }) {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    const node = document.createElement("div");
    node.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;";
    parentFor(gl).appendChild(node);
    const root = createRoot(node);
    root.render(<span className="text-sm text-stone-600">{children}</span>);
    return () => releaseRoot(root, node);
  }, [children, gl]);

  return null;
}

export default function FaceHtml({
  Bridge,
  position,
  rotation = [0, 0, 0],
  active,
  width,
  height,
  children,
}) {
  const [heldOpen, setHeldOpen] = useState(active);
  const [concealed, setConcealed] = useState(!active);
  const groupRef = useRef(null);
  const shellRef = useRef(null);
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const rootRef = useRef(null);
  const worldPos = useRef(new Vector3());
  const gl = useThree((state) => state.gl);

  if (active !== heldOpen) {
    setHeldOpen(active);
    if (active) setConcealed(false);
  }

  useLayoutEffect(() => {
    if (active) return undefined;
    const timer = setTimeout(() => setConcealed(true), 180);
    return () => clearTimeout(timer);
  }, [active]);

  useLayoutEffect(() => {
    const node = document.createElement("div");
    node.style.cssText = "position:absolute;top:0;left:0;pointer-events:none;overflow:hidden;";
    parentFor(gl).appendChild(node);
    shellRef.current = node;
    const root = createRoot(node);
    rootRef.current = root;
    return () => {
      if (rootRef.current === root) rootRef.current = null;
      if (shellRef.current === node) shellRef.current = null;
      releaseRoot(root, node);
    };
  }, [gl]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.render(
      <div
        ref={outerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          pointerEvents: "none",
        }}
      >
        <div
          ref={innerRef}
          style={{ position: "absolute", pointerEvents: active ? "auto" : "none" }}
        >
          <div
            data-testid="cube-face"
            data-position={JSON.stringify(position)}
            data-rotation={JSON.stringify(rotation)}
            style={{
              width,
              height,
              opacity: active ? 1 : 0,
              visibility: concealed ? "hidden" : "visible",
              transition: "opacity 160ms ease",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            <Bridge>
              <div
                inert={active ? undefined : true}
                aria-hidden={active ? undefined : true}
                style={{
                  width: "100%",
                  height: "100%",
                  pointerEvents: active ? "auto" : "none",
                }}
              >
                {children}
              </div>
            </Bridge>
          </div>
        </div>
      </div>,
    );
  });

  useFrame((state) => {
    const group = groupRef.current;
    const shell = shellRef.current;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!group || !shell || !outer || !inner) return;
    const { camera, size } = state;
    camera.updateMatrixWorld();
    group.updateWorldMatrix(true, false);
    const widthHalf = size.width / 2;
    const heightHalf = size.height / 2;
    const fov = camera.projectionMatrix.elements[5] * heightHalf;
    const cameraMatrix = getCameraCSSMatrix(camera.matrixWorldInverse);
    shell.style.width = `${size.width}px`;
    shell.style.height = `${size.height}px`;
    shell.style.perspective = `${fov}px`;
    outer.style.transform = `translateZ(${fov}px)${cameraMatrix}translate(${widthHalf}px,${heightHalf}px)`;
    inner.style.transform = getObjectCSSMatrix(group.matrixWorld, cssDistanceFactor(DISTANCE));
    const place = group.getWorldPosition(worldPos.current);
    const dist = place.distanceTo(camera.position);
    const slope = (Z_RANGE[1] - Z_RANGE[0]) / (camera.far - camera.near);
    shell.style.zIndex = `${Math.round(slope * dist + (Z_RANGE[1] - slope * camera.far))}`;
  });

  return <group ref={groupRef} position={position} rotation={rotation} />;
}
