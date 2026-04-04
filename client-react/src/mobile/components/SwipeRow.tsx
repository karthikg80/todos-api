import { useRef, useState, useCallback, type ReactNode } from "react";
import { useSwipeAction, SWIPE_THRESHOLD } from "../hooks/useSwipeAction";

interface Props {
  children: ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
}

export function SwipeRow({
  children, onSwipeRight, onSwipeLeft,
  rightLabel = "Complete", leftLabel = "Snooze",
}: Props) {
  const { offsetX, state, onTouchStart, onTouchMove, onTouchEnd, reset } = useSwipeAction();
  const rowRef = useRef<HTMLDivElement>(null);
  const [completing, setCompleting] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => onTouchStart(e.touches[0].clientX);
  const handleTouchMove = (e: React.TouchEvent) => onTouchMove(e.touches[0].clientX);
  const handleTouchEnd = () => onTouchEnd();

  const handleComplete = useCallback(() => {
    setCompleting(true);
    setTimeout(() => {
      onSwipeRight?.();
      if (navigator.vibrate) navigator.vibrate(10);
      reset();
    }, 280);
  }, [onSwipeRight, reset]);

  if (state === "triggered-right" && onSwipeRight && !completing) { handleComplete(); }
  else if (state === "triggered-right" && !onSwipeRight) { reset(); }
  else if (state === "triggered-left" && onSwipeLeft) { onSwipeLeft(); if (navigator.vibrate) navigator.vibrate(10); reset(); }
  else if (state === "triggered-left") { reset(); }

  const isSwipingRight = offsetX > 0;
  const progress = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);

  return (
    <div className={`m-swipe-row${completing ? " m-swipe-row--completing" : ""}`} ref={rowRef}>
      <div
        className={`m-swipe-row__action m-swipe-row__action--right${isSwipingRight ? " m-swipe-row__action--visible" : ""}`}
        style={{ opacity: isSwipingRight ? progress : 0 }}
      >
        <span className="m-swipe-row__action-label">✓ {rightLabel}</span>
      </div>
      <div
        className={`m-swipe-row__action m-swipe-row__action--left${!isSwipingRight && offsetX < 0 ? " m-swipe-row__action--visible" : ""}`}
        style={{ opacity: !isSwipingRight ? progress : 0 }}
      >
        <span className="m-swipe-row__action-label">◷ {leftLabel}</span>
      </div>
      <div
        className="m-swipe-row__content"
        style={{
          transform: state === "swiping" ? `translateX(${offsetX}px)` : undefined,
          transition: state === "idle" ? "transform var(--dur-base) var(--ease-spring)" : "none",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
