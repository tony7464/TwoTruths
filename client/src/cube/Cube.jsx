// The cube model plus the HTML panel on each face.
import { useThree } from "@react-three/fiber";
import { useContextBridge } from "its-fine";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  GuestNote,
  InboxFace,
  LoginFace,
  PlayersFace,
  ProfileFace,
  SignupFace,
  StatementsFace,
} from "./CubeFaces";
import FaceHtml from "./FaceHtml";
import { FACE_LAYOUT } from "./cubeLayout";
import { useCubeModel } from "./cubeModel";
import { useGame } from "./gameContext";

function indexNodes(root) {
  const map = {};
  root.traverse((obj) => {
    if (obj.name) map[obj.name] = obj;
  });
  return map;
}

export default function Cube({ htmlReady = true }) {
  const { anim, loggedIn } = useGame();
  // Face HTML renders outside the canvas. The bridge carries login state with it.
  const Bridge = useContextBridge();
  const { scene } = useCubeModel();
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    // Wait one frame so the panels measure after the canvas exists.
    const id = requestAnimationFrame(() => setPlaced(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Clone so this view does not move the cached model that useGLTF reuses.
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const nodes = useMemo(() => indexNodes(cloned), [cloned]);
  const camera = useThree((state) => state.camera);
  const { activeFace, locked, bind, setCamera, registerGroup } = anim;
  const groupRef = useRef(null);

  useEffect(() => {
    registerGroup(groupRef.current);
    setCamera(camera);
    bind([nodes.Eye_L, nodes.Eye_R]);
  }, [bind, camera, nodes, registerGroup, setCamera]);

  const open = (face) => activeFace === face && !locked;
  const content = {
    front: loggedIn ? <StatementsFace /> : <LoginFace />,
    back: loggedIn ? <ProfileFace /> : <GuestNote>Log in to build your profile</GuestNote>,
    left: loggedIn ? <PlayersFace /> : <GuestNote>Log in to see who is playing</GuestNote>,
    right: loggedIn ? <InboxFace /> : <SignupFace />,
  };
  // Keys stay the face id across login and logout. Swapping the child keeps the
  // Html root mounted; a new key would unmount it during this commit.
  const faces = FACE_LAYOUT.map((face) => ({ ...face, children: content[face.id] }));
  const showPanels = htmlReady && placed;

  return (
    <group ref={groupRef}>
      <primitive object={nodes.Cube_Frame} />
      <primitive object={nodes.Face_Front} />
      <primitive object={nodes.Face_Back} />
      <primitive object={nodes.Face_Left} />
      <primitive object={nodes.Face_Right} />
      <primitive object={nodes.Eye_L} />
      <primitive object={nodes.Eye_R} />

      {showPanels && faces.map((face) => (
        <FaceHtml
          key={face.id}
          Bridge={Bridge}
          position={face.position}
          rotation={face.rotation}
          active={open(face.id)}
          width={face.width}
          height={face.height}
        >
          {face.children}
        </FaceHtml>
      ))}
    </group>
  );
}
