// Cube screen: title, face buttons, and which way the cube should turn.
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import ErrorNote from "../components/ErrorNote";
import { useSpotTheLie } from "../components/useSpotTheLie";
import { useCubeAnimations } from "./animations";
import CubeScene from "./CubeScene";
import { faceToRoute, routeToFace } from "./cubeRoutes";
import { GameProvider } from "./gameContext";
import { STAGE_BACKGROUND, useCubeFallback } from "./useCubeMode";
import { useCubeFrame } from "./useCubeFrame";

const LOGGED_IN_FACES = [
  { id: "front", label: "Statements" },
  { id: "back", label: "Profile" },
  { id: "left", label: "Players" },
  { id: "right", label: "Inbox" },
];

const LOGGED_OUT_FACES = [
  { id: "front", label: "Log in" },
  { id: "right", label: "Sign up" },
];

const focusClass = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#047857]";

function buttonClass(active) {
  return `rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${focusClass} ${
    active
      ? "border-[#7eb7de] bg-white font-medium text-stone-900"
      : "border-white/80 bg-white/70 text-stone-700 hover:bg-white"
  }`;
}

export default function CubeModeApp() {
  const { user, logout } = useAuth();
  const fallback = useCubeFallback();
  const location = useLocation();
  const navigate = useNavigate();
  const loggedIn = Boolean(user);
  const anim = useCubeAnimations(routeToFace(location.pathname, loggedIn), Boolean(fallback?.shortMotion));
  const game = useSpotTheLie(loggedIn);
  const [status, setStatus] = useState("");
  const {
    activeFace,
    playing,
    turnTo,
    snapTo,
    playWrong,
    playCorrect,
    playAuthFail,
    playAuthSuccess,
    skip,
  } = anim;
  const pendingFace = useRef(null);
  const locationRef = useRef(location);
  const userRef = useRef(user);
  const stageRef = useRef(null);
  const frame = useCubeFrame(stageRef);
  const frameStyle = frame.size >= 2
    ? { width: frame.size, height: frame.size, marginLeft: frame.offset }
    : { width: "min(78vh, 720px)", height: "min(78vh, 720px)", maxWidth: "100%", marginInline: "auto" };

  useEffect(() => {
    locationRef.current = location;
    userRef.current = user;
  }, [location, user]);

  function followFace(face, signedIn = Boolean(userRef.current)) {
    const path = faceToRoute(face, signedIn);
    if (locationRef.current.pathname !== path) {
      pendingFace.current = face;
      navigate(path, { replace: true });
    }
  }

  function selectFace(face) {
    followFace(face);
    turnTo(face);
  }

  useEffect(() => {
    // A turn we started already updated the URL. Do not snap the cube a second time.
    const face = routeToFace(location.pathname, loggedIn);
    if (pendingFace.current === face) {
      pendingFace.current = null;
      return;
    }
    if (playing) return;
    if (activeFace !== face) snapTo(face);
  }, [activeFace, playing, snapTo, location.pathname, loggedIn]);

  async function handleGuess() {
    if (!game.current) return;
    const result = await game.lockInGuess(game.current);
    if (!result) return;
    if (result.is_correct) {
      setStatus("Correct");
      followFace("right", true);
      playCorrect();
      return;
    }
    setStatus("Wrong, pick another player");
    followFace("left", true);
    playWrong();
  }

  function handlePick(id) {
    game.setPickedId(id);
    selectFace("front");
  }

  function onLoginSuccess() {
    setStatus("Logged in");
    userRef.current = true;
    followFace("front", true);
    playAuthSuccess();
  }

  function onSignupSuccess() {
    setStatus("Signed up");
    userRef.current = true;
    followFace("front", true);
    playAuthSuccess();
  }

  async function handleLogout() {
    pendingFace.current = "front";
    await logout();
    userRef.current = null;
    const path = faceToRoute("front", false);
    if (locationRef.current.pathname !== path) {
      pendingFace.current = "front";
      navigate(path, { replace: true });
    }
    turnTo("front");
  }

  const faces = loggedIn ? LOGGED_IN_FACES : LOGGED_OUT_FACES;

  return (
    <div className="relative min-h-screen text-stone-900" style={{ background: STAGE_BACKGROUND }}>
      <header className="flex items-center gap-3 px-4 py-3 text-sm">
        <span className="font-semibold">Two Truths</span>
        {user ? (
          <>
            <span className="text-stone-600">{user.username}, score {user.score}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-auto rounded-md border border-white/80 bg-white/70 px-2 py-1 hover:bg-white"
            >
              Log out
            </button>
          </>
        ) : null}
      </header>

      <div className="flex flex-col items-center px-3 pb-8">
        <div ref={stageRef} className="w-full">
          <div className="relative" style={frameStyle}>
            <GameProvider
              value={{
                anim,
                loggedIn,
                game,
                onGuess: handleGuess,
                onPick: handlePick,
                onShowPlayers: () => selectFace("left"),
                onLoginSuccess,
                onLoginFailure: () => playAuthFail(),
                onSignupSuccess,
                onSignupFailure: () => playAuthFail(),
                onShowLogin: () => selectFace("front"),
                onShowSignup: () => selectFace("right"),
              }}
            >
              <CubeScene />
            </GameProvider>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Cube faces">
          {faces.map((face) => (
            <button
              key={face.id}
              type="button"
              aria-label={`${face.label} face`}
              aria-pressed={activeFace === face.id}
              disabled={playing}
              onClick={() => selectFace(face.id)}
              className={buttonClass(activeFace === face.id)}
            >
              {face.label}
            </button>
          ))}
          <button type="button" onClick={fallback?.chooseFlat} className={buttonClass(false)}>
            Use flat view
          </button>
        </div>

        {playing && (
          <button
            type="button"
            onClick={skip}
            className="mt-2 rounded-md border border-white/80 bg-white/80 px-3 py-2 text-sm hover:bg-white"
          >
            Skip animation
          </button>
        )}
        <div className="mt-2 w-full max-w-md">
          <ErrorNote message={loggedIn ? game.error : ""} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{status}</p>

      <Routes>
        <Route path="/" element={<Navigate to={loggedIn ? "/browse" : "/login"} replace />} />
        <Route path="/login" element={loggedIn ? <Navigate to="/browse" replace /> : null} />
        <Route path="/signup" element={loggedIn ? <Navigate to="/browse" replace /> : null} />
        <Route path="/browse" element={loggedIn ? null : <Navigate to="/login" replace />} />
        <Route path="/profile" element={loggedIn ? null : <Navigate to="/login" replace />} />
        <Route path="/inbox" element={loggedIn ? null : <Navigate to="/login" replace />} />
        <Route path="/players" element={loggedIn ? null : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
