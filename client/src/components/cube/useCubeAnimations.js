import { useCallback, useEffect, useRef, useState } from "react";
import {
  createCorrectTimeline,
  createIdleTimeline,
  createSlamTimeline,
  createWrongTimeline,
  settlePose,
} from "./cubeTimelines";

export function useCubeAnimations() {
  const groupRef = useRef(null);
  const eyesRef = useRef([]);
  const cameraRef = useRef(null);
  const activeTl = useRef(null);
  const idleTl = useRef(null);
  const mounted = useRef(true);
  const playingRef = useRef(false);
  const opacity = useRef({ value: 1 });
  const [activeFace, setActiveFace] = useState("front");
  const [playing, setPlaying] = useState(false);
  const [locked, setLocked] = useState(false);
  const [inboxOpacity, setInboxOpacity] = useState(1);

  const stopIdle = useCallback(() => {
    idleTl.current?.kill();
    idleTl.current = null;
  }, []);

  const stopActive = useCallback(() => {
    activeTl.current?.kill();
    activeTl.current = null;
  }, []);

  const startIdle = useCallback(() => {
    if (!mounted.current || eyesRef.current.length === 0) return;
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
    if (playingRef.current || face === activeFace) return;
    const group = groupRef.current;
    if (!group) return;
    settlePose(group);
    setActiveFace(face);
    play(createSlamTimeline(group, face));
  }, [activeFace, play]);

  const playWrong = useCallback(() => {
    const group = groupRef.current;
    if (!group || playingRef.current) return;
    settlePose(group);
    play(createWrongTimeline(group, eyesRef.current, () => {
      if (mounted.current) setActiveFace("left");
    }));
  }, [play]);

  const playCorrect = useCallback(() => {
    const group = groupRef.current;
    const camera = cameraRef.current;
    if (!group || !camera || playingRef.current) return;
    settlePose(group);
    opacity.current.value = 0;
    setInboxOpacity(0);
    play(createCorrectTimeline({
      group,
      eyes: eyesRef.current,
      camera,
      opacity: opacity.current,
      onSpinStart: () => {
        if (mounted.current) setActiveFace("right");
      },
      onSpinEnd: () => {
        if (mounted.current) setLocked(false);
      },
      onOpacity: (value) => {
        if (mounted.current) setInboxOpacity(value);
      },
    }));
  }, [play]);

  const skip = useCallback(() => {
    activeTl.current?.progress(1);
  }, []);

  const setCamera = useCallback((camera) => {
    cameraRef.current = camera;
  }, []);

  const registerGroup = useCallback((group) => {
    groupRef.current = group;
  }, []);

  const bind = useCallback((eyes) => {
    eyesRef.current = eyes;
    startIdle();
  }, [startIdle]);

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
    playWrong,
    playCorrect,
    skip,
    setCamera,
    registerGroup,
    bind,
  };
}
