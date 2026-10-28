// The 3D canvas, lights, and the shadow under the cube.
import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import Cube from "./Cube";
import { CenteredNote } from "./FaceHtml";
import { CUBE_URL } from "./cubeModel";
import { useGame } from "./gameContext";
import { useCubeFallback, useHtmlReady } from "./useCubeMode";

useGLTF.preload(CUBE_URL, true, false);

export default function CubeScene() {
  const { anim } = useGame();
  const envRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const fallback = useCubeFallback();
  const htmlReady = useHtmlReady(canvas, fallback?.reportContextLost);
  // Flat mode can keep this canvas for one frame. Hide the panels in that commit
  // so their roots are gone before the canvas unmounts.
  const panelsOn = htmlReady && fallback?.mode !== "flat";

  useEffect(() => () => {
    const env = envRef.current;
    if (!env) return;
    env.scene.environment = null;
    env.target.texture.dispose();
    env.target.dispose();
    env.pmrem.dispose();
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0.28, 5.15], fov: 30 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent" }}
      onCreated={({ gl, scene, camera }) => {
        // NoToneMapping keeps the pastel panel near its sRGB hex. A local room
        // stands in for an environment map so drei's CDN presets are not used.
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
        gl.domElement.setAttribute("role", "img");
        gl.domElement.setAttribute("aria-label", "Two Truths cube");
        setCanvas(gl.domElement);
        camera.lookAt(0, 0, 0);
        anim.setCamera(camera);

        const room = new THREE.Scene();
        room.background = new THREE.Color("#e9f6fd");
        const pmrem = new THREE.PMREMGenerator(gl);
        const target = pmrem.fromScene(room, 0.04);
        scene.environment = target.texture;
        scene.environmentIntensity = 0.32;
        envRef.current = { scene, target, pmrem };
      }}
    >
      <hemisphereLight args={["#f7fbff", "#d5e4f4", 1.15]} />
      <ambientLight intensity={0.32} color="#ffffff" />
      <directionalLight position={[2.6, 4.8, 5.4]} intensity={1.0} color="#fffefb" />
      <directionalLight position={[-3.6, 1.4, 2.2]} intensity={0.4} color="#f3f8ff" />
      <ContactShadows
        position={[0, -1.05, 0]}
        opacity={0.32}
        scale={8}
        blur={2.6}
        far={3.2}
        resolution={256}
        color="#7f93b0"
      />
      <Suspense fallback={<CenteredNote>Loading cube...</CenteredNote>}>
        <Cube htmlReady={panelsOn} />
      </Suspense>
    </Canvas>
  );
}
