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
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startTime = useRef(0);

  const goNext = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.min(i + 1, count - 1);
      if (next !== i) onIndexChange?.(next);
      return next;
    });
  }, [count, locked, onIndexChange]);

  const goPrev = useCallback(() => {
    if (locked) return;
    setActiveIndex((i) => {
      const next = Math.max(i - 1, 0);
      if (next !== i) onIndexChange?.(next);
      return next;
    });
  }, [locked, onIndexChange]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (locked) return;
      startX.current = e.clientX;
      startTime.current = Date.now();
      setIsDragging(true);
      setDragOffset(0);
    },
    [locked],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || locked) return;
      let dx = e.clientX - startX.current;

      const atStart = activeIndex === 0 && dx > 0;
      const atEnd = activeIndex === count - 1 && dx < 0;
      if (atStart || atEnd) {
        dx = dx * RUBBER_DAMPING;
      }

      setDragOffset(dx);
    },
    [isDragging, locked, activeIndex, count],
  );

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dragOffset) / Math.max(elapsed, 1);
    const committed =
      Math.abs(dragOffset) > COMMIT_THRESHOLD || velocity > VELOCITY_THRESHOLD;

    if (committed && dragOffset < 0) {
      goNext();
    } else if (committed && dragOffset > 0) {
      goPrev();
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, goNext, goPrev]);

  const handlers = useMemo(
    () => ({
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp],
  );

  return { activeIndex, dragOffset, isDragging, handlers, goNext, goPrev };
}
