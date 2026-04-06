import { useState, useRef, useCallback, useMemo } from "react";

const COMMIT_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 0.3;
const RUBBER_DAMPING = 0.4;

interface Options {
  count: number;
  locked?: boolean;
  onIndexChange?: (index: number) => void;
}

export function useSwipeNavigation({ count, locked, onIndexChange }: Options) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Refs for drag state — mutated directly to avoid React re-renders during drag
  const startX = useRef(0);
  const startTime = useRef(0);
  const dragOffsetRef = useRef(0);
  const trackRef = useRef<HTMLElement | null>(null);
  const indexRef = useRef(0); // mirrors activeIndex without stale closure issues

  const applyTransform = useCallback((index: number, dx: number) => {
    if (!trackRef.current) return;
    const width = trackRef.current.parentElement?.clientWidth ?? window.innerWidth;
    const pct = -(index * 100) + (dx / width) * 100;
    trackRef.current.style.transform = `translateX(${pct}%)`;
  }, []);

  const goNext = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.min(i + 1, count - 1);
      if (next !== i) {
        indexRef.current = next;
        onIndexChange?.(next);
      }
      return next;
    });
  }, [count, locked, onIndexChange]);

  const goPrev = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.max(i - 1, 0);
      if (next !== i) {
        indexRef.current = next;
        onIndexChange?.(next);
      }
      return next;
    });
  }, [locked, onIndexChange]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked) return;
      const el = e.currentTarget as HTMLElement;
      trackRef.current = el;
      // Disable CSS transition during drag
      el.classList.add("m-carousel__track--dragging");

      startX.current = e.clientX;
      startTime.current = Date.now();
      dragOffsetRef.current = 0;
      setIsDragging(true);
    },
    [locked],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!trackRef.current || locked) return;
      let dx = e.clientX - startX.current;

      // Rubber-band at edges
      const idx = indexRef.current;
      const atStart = idx === 0 && dx > 0;
      const atEnd = idx === count - 1 && dx < 0;
      if (atStart || atEnd) {
        dx = dx * RUBBER_DAMPING;
      }

      dragOffsetRef.current = dx;
      // Direct DOM mutation — no React state update, no re-render
      applyTransform(idx, dx);
    },
    [locked, count, applyTransform],
  );

  const onPointerUp = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;

    // Re-enable CSS transition for snap animation
    el.classList.remove("m-carousel__track--dragging");
    setIsDragging(false);

    const dx = dragOffsetRef.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dx) / Math.max(elapsed, 1);
    const committed =
      Math.abs(dx) > COMMIT_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (committed && dx < 0) {
      goNext();
    } else if (committed && dx > 0) {
      goPrev();
    } else {
      // Snap back — apply transform at current index with 0 offset
      applyTransform(indexRef.current, 0);
    }

    dragOffsetRef.current = 0;
    trackRef.current = null;
  }, [goNext, goPrev, applyTransform]);

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp],
  );

  return { activeIndex, isDragging, handlers, goNext, goPrev };
}
