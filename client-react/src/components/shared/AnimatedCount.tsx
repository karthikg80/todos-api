import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  className?: string;
}

export function AnimatedCount({ value, className }: Props) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;

    // Animate from prev to value
    const diff = value - prev;
    const steps = Math.min(Math.abs(diff), 10);
    const stepDuration = 150 / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setDisplay(Math.round(prev + diff * progress));
      if (step >= steps) {
        clearInterval(timer);
        setDisplay(value);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value]);

  return <span className={className}>{display}</span>;
}
