import { useState, useCallback, useRef } from "react";

export const SWIPE_THRESHOLD = 80;

export type SwipeState = "idle" | "swiping" | "triggered-right" | "triggered-left";

export function useSwipeAction() {
  const [offsetX, setOffsetX] = useState(0);
  const [state, setState] = useState<SwipeState>("idle");
  const startXRef = useRef(0);

  const onTouchStart = useCallback((clientX: number) => {
    startXRef.current = clientX;
    setState("swiping");
  }, []);

  const onTouchMove = useCallback((clientX: number) => {
    setOffsetX(clientX - startXRef.current);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (offsetX > SWIPE_THRESHOLD) {
      setState("triggered-right");
    } else if (offsetX < -SWIPE_THRESHOLD) {
      setState("triggered-left");
    } else {
      setState("idle");
      setOffsetX(0);
    }
  }, [offsetX]);

  const reset = useCallback(() => {
    setState("idle");
    setOffsetX(0);
  }, []);

  return { offsetX, state, onTouchStart, onTouchMove, onTouchEnd, reset };
}
