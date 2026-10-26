import { ContactShadows, Html, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import Cube from "./Cube";
import { CUBE_URL } from "./cubeModel";
import { useCubeAnimations } from "./useCubeAnimations";

useGLTF.preload(CUBE_URL, true, false);

const FACES = [
  { id: "front", label: "Statements" },
  { id: "back", label: "Profile" },
  { id: "left", label: "Players" },
  { id: "right", label: "Inbox" },
];

const STAGE = {
  background: "linear-gradient(180deg, #d7eefb 0%, #e6e2fb 55%, #fbf9ff 100%)",
};

export default function CubeScene({
  profiles,
  current,
  onPick,
  selectedId,
  onSelect,
  onGuess,
  message,
  onMessageChange,
  onSend,
  sending,
  sent,
}) {
  const anim = useCubeAnimations();

  async function handleGuess() {
    const result = await onGuess();
    if (!result) return;
    if (result.is_correct) anim.playCorrect();
    else anim.playWrong();
  }

  function handlePick(id) {
    onPick(id);
    if (anim.activeFace !== "front") anim.turnTo("front");
  }

  const buttonClass = (active) =>
    `rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${
      active ? "border-emerald-700 bg-emerald-50 font-medium" : "border-stone-300 bg-white hover:bg-stone-50"
    }`;

  return (
    <div className="mx-auto w-full max-w-[640px]">
      <div className="relative h-[560px] w-full overflow-hidden rounded-2xl" style={STAGE}>
        <Canvas
          camera={{ position: [0, 0.15, 6.2], fov: 30 }}
          dpr={[1, 1.75]}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.NoToneMapping }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent" }}
          onCreated={({ gl, camera }) => {
            gl.setClearColor(0x000000, 0);
            gl.domElement.setAttribute("aria-hidden", "true");
            camera.lookAt(0, 0, 0);
            anim.setCamera(camera);
          }}
        >
          <ambientLight intensity={0.82} color="#f7fbff" />
          <directionalLight position={[2.4, 4.2, 3.2]} intensity={1.2} />
          <ContactShadows
            position={[0, -1.04, 0]}
            opacity={0.38}
            scale={7}
            blur={2.4}
            far={3}
            resolution={256}
            color="#7f93b0"
          />
          <Suspense fallback={<Html center><span className="text-sm text-stone-600">Loading cube...</span></Html>}>
            <Cube
              anim={anim}
              profiles={profiles}
              current={current}
              onPick={handlePick}
              selectedId={selectedId}
              onSelect={onSelect}
              onGuess={handleGuess}
              message={message}
              onMessageChange={onMessageChange}
              onSend={onSend}
              sending={sending}
              sent={sent}
            />
          </Suspense>
        </Canvas>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Cube faces">
        {FACES.map((face) => (
          <button
            key={face.id}
            type="button"
            aria-pressed={anim.activeFace === face.id}
            disabled={anim.playing}
            onClick={() => anim.turnTo(face.id)}
            className={buttonClass(anim.activeFace === face.id)}
          >
            {face.label}
          </button>
        ))}
      </div>

      {anim.playing && (
        <button
          type="button"
          onClick={anim.skip}
          className="mt-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm hover:bg-stone-50"
        >
          Skip animation
        </button>
      )}
    </div>
  );
}
