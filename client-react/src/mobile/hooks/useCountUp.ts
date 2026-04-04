import { useState, useEffect, useRef } from "react";

export function useCountUp(target: number, duration: number = 800): number {
  const [value, setValue] = useState(0);
  const startTime = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startTime.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress >= 1) {
        clearInterval(tickRef.current);
      }
    };

    tickRef.current = setInterval(tick, 16);
    tick();
    return () => clearInterval(tickRef.current);
  }, [target, duration]);

  return value;
}
