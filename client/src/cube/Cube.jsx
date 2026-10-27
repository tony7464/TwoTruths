// The cube model plus the HTML panel on each face.
import { Html } from "@react-three/drei";
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
import { useCubeModel } from "./cubeModel";

// CSS pixels * distanceFactor / 400 = world units. 1.66 fills the 1.704 panel.
const DISTANCE = 1.4;
const PANEL = "474px";
const FRONT_H = "280px";

function indexNodes(root) {
  const map = {};
  root.traverse((obj) => {
    if (obj.name) map[obj.name] = obj;
  });
  return map;
}

function FaceHtml({ Bridge, position, rotation = [0, 0, 0], active, width, height, children }) {
  const [heldOpen, setHeldOpen] = useState(active);
  const [concealed, setConcealed] = useState(!active);

  if (active !== heldOpen) {
    setHeldOpen(active);
    if (active) setConcealed(false);
  }

  useEffect(() => {
    if (active) return undefined;
    // 180ms is just longer than the 160ms fade, then the panel is hidden.
    const timer = setTimeout(() => setConcealed(true), 180);
    return () => clearTimeout(timer);
  }, [active]);

  return (
    <Html
      transform
      position={position}
      rotation={rotation}
      distanceFactor={DISTANCE}
      pointerEvents={active ? "auto" : "none"}
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
    </Html>
  );
}

export default function Cube({
  anim,
  loggedIn,
  game,
  onGuess,
  onPick,
  onShowPlayers,
  onLoginSuccess,
  onLoginFailure,
  onSignupSuccess,
  onSignupFailure,
  onShowLogin,
  onShowSignup,
}) {
  // Face HTML renders outside the canvas. The bridge carries login state with it.
  const Bridge = useContextBridge();
  const { scene } = useCubeModel();
  const [htmlReady, setHtmlReady] = useState(false);

  useEffect(() => {
    // Wait one frame so the panels measure after the canvas exists.
    const id = requestAnimationFrame(() => setHtmlReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // Clone so this view does not move the cached model that useGLTF reuses.
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
  const current = game.current;

  return (
    <group ref={groupRef}>
      <primitive object={nodes.Cube_Frame} />
      <primitive object={nodes.Face_Front} />
      <primitive object={nodes.Face_Back} />
      <primitive object={nodes.Face_Left} />
      <primitive object={nodes.Face_Right} />
      <primitive object={nodes.Eye_L} />
      <primitive object={nodes.Eye_R} />

      {htmlReady && <FaceHtml Bridge={Bridge} position={[0, -0.36, 0.975]} active={open("front")} width={PANEL} height={FRONT_H}>
        {loggedIn ? (
          <StatementsFace
            profile={current}
            selectedId={current ? game.selected[current.id] : undefined}
            onSelect={(statementId) => {
              if (!current) return;
              game.setSelected((items) => ({ ...items, [current.id]: statementId }));
            }}
            onGuess={onGuess}
            onShowPlayers={onShowPlayers}
            loading={game.loading}
          />
        ) : (
          <LoginFace
            onSuccess={onLoginSuccess}
            onFailure={onLoginFailure}
            onShowSignup={onShowSignup}
          />
        )}
      </FaceHtml>}

      {htmlReady && <FaceHtml
        Bridge={Bridge}
        position={[0, 0, -0.975]}
        rotation={[0, Math.PI, 0]}
        active={open("back")}
        width={PANEL}
        height={PANEL}
      >
        {loggedIn ? <ProfileFace /> : <GuestNote>Log in to build your profile</GuestNote>}
      </FaceHtml>}

      {htmlReady && <FaceHtml
        Bridge={Bridge}
        position={[-0.975, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        active={open("left")}
        width={PANEL}
        height={PANEL}
      >
        {loggedIn ? (
          <PlayersFace profiles={game.profiles} currentId={current?.id} onPick={onPick} />
        ) : (
          <GuestNote>Log in to see who is playing</GuestNote>
        )}
      </FaceHtml>}

      {htmlReady && <FaceHtml
        Bridge={Bridge}
        position={[0.975, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        active={open("right")}
        width={PANEL}
        height={PANEL}
      >
        {loggedIn ? (
          <InboxFace
            profile={current}
            message={current ? game.messageDraft(current) : ""}
            onMessageChange={(value) => {
              if (!current) return;
              game.setDrafts((items) => ({ ...items, [current.id]: value }));
            }}
            onSend={() => current && game.sendMessage(current)}
            sending={Boolean(current && game.sending[current.id])}
            sent={Boolean(current && game.sent[current.id])}
            opacity={inboxOpacity}
          />
        ) : (
          <SignupFace
            onSuccess={onSignupSuccess}
            onFailure={onSignupFailure}
            onShowLogin={onShowLogin}
          />
        )}
      </FaceHtml>}
    </group>
  );
}
