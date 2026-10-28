// Plays cube turns. Refs hold the Three.js objects GSAP animates between renders.
import { useCallback, useEffect, useRef, useState } from "react";
import { faceYaw } from "./cubeMath";
import {
  createAuthFailTimeline,
  createAuthSuccessTimeline,
  createCorrectTimeline,
  createIdleTimeline,
  createQuickMoodTimeline,
  createQuickTurnTimeline,
  createSlamTimeline,
  createWrongTimeline,
  settlePose,
} from "./timelines";

export function useCubeAnimations(initialFace = "front", quick = false) {
  const groupRef = useRef(null);
  const eyesRef = useRef([]);
  const cameraRef = useRef(null);
  const activeTl = useRef(null);
  const idleTl = useRef(null);
  const mounted = useRef(true);
  const playingRef = useRef(false);
  const desiredFace = useRef(initialFace);
  const activeFaceRef = useRef(initialFace);
  const quickRef = useRef(quick);
  const opacity = useRef({ value: 1 });
  const [activeFace, setActiveFace] = useState(initialFace);
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [inboxOpacity, setInboxOpacity] = useState(1);

  const showFace = useCallback((face) => {
    desiredFace.current = face;
    activeFaceRef.current = face;
    setActiveFace(face);
  }, []);

  const stopIdle = useCallback(() => {
    idleTl.current?.kill();
    idleTl.current = null;
  }, []);

  const stopActive = useCallback(() => {
    activeTl.current?.kill();
    activeTl.current = null;
  }, []);

  const startIdle = useCallback(() => {
    if (!mounted.current || eyesRef.current.length === 0 || quickRef.current) return;
    stopIdle();
    idleTl.current = createIdleTimeline(eyesRef.current);
  }, [stopIdle]);

  const finish = useCallback(() => {
    activeTl.current = null;
    playingRef.current = false;
    if (!mounted.current) return;
    setPlaying(false);
    setLocked(false);
    startIdle();
  }, [startIdle]);

  const play = useCallback((timeline) => {
    stopIdle();
    stopActive();
    activeTl.current = timeline;
    playingRef.current = true;
    setPlaying(true);
    setLocked(true);
    timeline.eventCallback("onComplete", finish);
    timeline.play();
  }, [finish, stopActive, stopIdle]);

  const turnTo = useCallback((face) => {
    if (playingRef.current || face === activeFaceRef.current) return;
    const group = groupRef.current;
    showFace(face);
    if (!group) return;
    settlePose(group);
    if (quickRef.current) {
      play(createQuickTurnTimeline(group, face, eyesRef.current));
      return;
    }
    play(createSlamTimeline(group, face));
  }, [play, showFace]);

  const snapTo = useCallback((face) => {
    showFace(face);
    const group = groupRef.current;
    if (!group || playingRef.current) return;
    settlePose(group);
    group.rotation.y = faceYaw(face);
  }, [showFace]);

  // Reduced motion plays quick. full and quick get the group, or null if it is not mounted.
  const playVariant = useCallback((face, full, quick) => {
    if (playingRef.current) return;
    if (face) showFace(face);
    const group = groupRef.current;
    if (!group) {
      quick(null);
      return;
    }
    settlePose(group);
    if (quickRef.current) {
      const timeline = quick(group);
      if (timeline) play(timeline);
      return;
    }
    const timeline = full(group);
    if (timeline) {
      play(timeline);
      return;
    }
    const fallback = quick(group);
    if (fallback) play(fallback);
  }, [play, showFace]);

  const playWrong = useCallback(() => {
    playVariant(
      "left",
      (group) => createWrongTimeline(group, eyesRef.current, () => {
        if (mounted.current) showFace("left");
      }),
      (group) => (group ? createQuickTurnTimeline(group, "left", eyesRef.current) : null),
    );
  }, [playVariant, showFace]);

  const playCorrect = useCallback(() => {
    playVariant(
      "right",
      (group) => {
        const camera = cameraRef.current;
        if (!camera) return null;
        opacity.current.value = 0;
        setInboxOpacity(0);
        return createCorrectTimeline({
          group,
          eyes: eyesRef.current,
          camera,
          opacity: opacity.current,
          onSpinStart: () => {
            if (mounted.current) showFace("right");
          },
          onSpinEnd: () => {
            if (mounted.current) setLocked(false);
          },
          onOpacity: (value) => {
            if (mounted.current) setInboxOpacity(value);
          },
        });
      },
      (group) => {
        setInboxOpacity(1);
        if (!group) return null;
        return createQuickTurnTimeline(group, "right", eyesRef.current, "Happy");
      },
    );
  }, [playVariant, showFace]);

  const playAuthFail = useCallback(() => {
    playVariant(
      null,
      (group) => createAuthFailTimeline(group, eyesRef.current),
      (group) => (group ? createQuickMoodTimeline(eyesRef.current, "Sad_Disapproval") : null),
    );
  }, [playVariant]);

  const playAuthSuccess = useCallback(() => {
    playVariant(
      "front",
      (group) => createAuthSuccessTimeline(group, eyesRef.current, () => {
        if (mounted.current) showFace("front");
      }),
      (group) => (group ? createQuickTurnTimeline(group, "front", eyesRef.current, "Happy") : null),
    );
  }, [playVariant, showFace]);

  const skip = useCallback(() => {
    activeTl.current?.progress(1);
  }, []);

  const setCamera = useCallback((camera) => {
    cameraRef.current = camera;
  }, []);

  const registerGroup = useCallback((group) => {
    groupRef.current = group;
    if (!group || playingRef.current) return;
    group.rotation.y = faceYaw(desiredFace.current);
  }, []);

  const bind = useCallback((eyes) => {
    eyesRef.current = eyes;
    startIdle();
  }, [startIdle]);

  useEffect(() => {
    quickRef.current = quick;
    if (quick) stopIdle();
  }, [quick, stopIdle]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopIdle();
      stopActive();
    };
  }, [stopActive, stopIdle]);

  return {
    activeFace,
    playing,
    locked,
    inboxOpacity,
    turnTo,
    snapTo,
    playWrong,
    playCorrect,
    playAuthFail,
    playAuthSuccess,
    skip,
    setCamera,
    registerGroup,
    bind,
  };
}
