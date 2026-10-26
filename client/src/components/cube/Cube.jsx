import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { InboxFace, PlayersFace, ProfileFace, StatementsFace } from "./CubeFaces";
import { useCubeModel } from "./cubeModel";

const DISTANCE = 2.1;
const PANEL = "324px";
const FRONT_H = "190px";

function indexNodes(root) {
  const map = {};
  root.traverse((obj) => {
    if (obj.name) map[obj.name] = obj;
  });
  return map;
}

function FaceHtml({ position, rotation, interactive, width, height, children }) {
  return (
    <Html
      transform
      occlude="blending"
      position={position}
      rotation={rotation}
      distanceFactor={DISTANCE}
      pointerEvents={interactive ? "auto" : "none"}
      style={{ width, height }}
    >
      <div
        inert={interactive ? undefined : true}
        aria-hidden={interactive ? undefined : true}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: interactive ? "auto" : "none",
        }}
      >
        {children}
      </div>
    </Html>
  );
}

export default function Cube({
  anim,
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
  const { scene } = useCubeModel();
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const nodes = useMemo(() => indexNodes(cloned), [cloned]);
  const camera = useThree((state) => state.camera);
  const { activeFace, locked, inboxOpacity, bind, setCamera, registerGroup } = anim;
  const groupRef = useRef(null);

  useEffect(() => {
    registerGroup(groupRef.current);
    setCamera(camera);
    bind([nodes.Eye_L, nodes.Eye_R]);
  }, [bind, camera, nodes, registerGroup, setCamera]);

  const open = (face) => activeFace === face && !locked;

  return (
    <group ref={groupRef}>
      <primitive object={nodes.Cube_Frame} />
      <primitive object={nodes.Face_Front} />
      <primitive object={nodes.Face_Back} />
      <primitive object={nodes.Face_Left} />
      <primitive object={nodes.Face_Right} />
      <primitive object={nodes.Eye_L} />
      <primitive object={nodes.Eye_R} />

      {/* Front text sits under the eyes (y about -0.85..0.15), not over them. */}
      <FaceHtml
        position={[0, -0.35, 0.975]}
        interactive={open("front")}
        width={PANEL}
        height={FRONT_H}
      >
        <StatementsFace
          profile={current}
          selectedId={selectedId}
          onSelect={onSelect}
          onGuess={onGuess}
        />
      </FaceHtml>

      <FaceHtml
        position={[0, 0, -0.975]}
        rotation={[0, Math.PI, 0]}
        interactive={open("back")}
        width={PANEL}
        height={PANEL}
      >
        <ProfileFace />
      </FaceHtml>

      <FaceHtml
        position={[-0.975, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        interactive={open("left")}
        width={PANEL}
        height={PANEL}
      >
        <PlayersFace profiles={profiles} currentId={current?.id} onPick={onPick} />
      </FaceHtml>

      <FaceHtml
        position={[0.975, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        interactive={open("right")}
        width={PANEL}
        height={PANEL}
      >
        <InboxFace
          profile={current}
          message={message}
          onMessageChange={onMessageChange}
          onSend={onSend}
          sending={sending}
          sent={sent}
          opacity={inboxOpacity}
        />
      </FaceHtml>
    </group>
  );
}
