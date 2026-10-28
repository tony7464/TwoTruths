import { useEffect, useState } from "react";
import { readCubeFrame } from "./cubeFrame";

function sameFrame(left, right) {
  return left.size === right.size && left.offset === right.offset;
}

export function useCubeFrame(containerRef) {
  const [frame, setFrame] = useState(() => readCubeFrame(null));

  useEffect(() => {
    const update = () => {
      const next = readCubeFrame(containerRef.current);
      setFrame((current) => (sameFrame(current, next) ? current : next));
    };
    update();
    window.addEventListener("resize", update);
    let observer;
    if (typeof ResizeObserver === "function" && containerRef.current) {
      observer = new ResizeObserver(update);
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [containerRef]);

  return frame;
}
