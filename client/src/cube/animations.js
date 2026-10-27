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

  const playWrong = useCallback(() => {
    if (playingRef.current) return;
    showFace("left");
    const group = groupRef.current;
    if (!group) return;
    settlePose(group);
    if (quickRef.current) {
      play(createQuickTurnTimeline(group, "left", eyesRef.current));
      return;
    }
    play(createWrongTimeline(group, eyesRef.current, () => {
      if (mounted.current) showFace("left");
    }));
  }, [play, showFace]);

  const playCorrect = useCallback(() => {
    if (playingRef.current) return;
    showFace("right");
    const group = groupRef.current;
    const camera = cameraRef.current;
    if (!group || !camera || quickRef.current) {
      setInboxOpacity(1);
      if (group) {
        settlePose(group);
        play(createQuickTurnTimeline(group, "right", eyesRef.current, "Happy"));
      }
      return;
    }
    settlePose(group);
    opacity.current.value = 0;
    setInboxOpacity(0);
    play(createCorrectTimeline({
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
    }));
  }, [play, showFace]);

  const playAuthFail = useCallback(() => {
    if (playingRef.current) return;
    const group = groupRef.current;
    if (!group) return;
    settlePose(group);
    if (quickRef.current) {
      play(createQuickMoodTimeline(eyesRef.current, "Sad_Disapproval"));
      return;
    }
    play(createAuthFailTimeline(group, eyesRef.current));
  }, [play]);

  const playAuthSuccess = useCallback(() => {
    if (playingRef.current) return;
    showFace("front");
    const group = groupRef.current;
    if (!group) return;
    settlePose(group);
    if (quickRef.current) {
      play(createQuickTurnTimeline(group, "front", eyesRef.current, "Happy"));
      return;
    }
    play(createAuthSuccessTimeline(group, eyesRef.current, () => {
      if (mounted.current) showFace("front");
    }));
  }, [play, showFace]);

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
