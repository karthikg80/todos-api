import { useState, useRef, useCallback, type ReactNode } from "react";
import type { BottomSheetSnap } from "../hooks/useBottomSheet";

interface Props {
  snap: BottomSheetSnap;
  onClose: () => void;
  onExpandFull: () => void;
  halfContent: ReactNode;
  fullContent: ReactNode;
}

const SNAP_HEIGHTS: Record<BottomSheetSnap, string> = {
  closed: "0%", half: "55%", full: "95%",
};

export function BottomSheet({ snap, onClose, onExpandFull, halfContent, fullContent }: Props) {
  const dragStartY = useRef(0);
  const dragStartTime = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragStartTime.current = Date.now();
    isDragging.current = true;
  }, []);

  const handleDragMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    // Only allow dragging down (positive) or up (negative)
    setDragOffset(deltaY);
  }, []);

  const handleDragEnd = useCallback((e: React.TouchEvent) => {
    isDragging.current = false;
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    const elapsed = Date.now() - dragStartTime.current;
    const velocity = elapsed > 0 ? deltaY / elapsed : 0; // px/ms, positive = downward

    setDragOffset(0);

    // Fast flick or large drag down
    if (velocity > 0.5 || deltaY > 100) {
      if (snap === "full") onExpandFull(); // could shrink to half, but simpler to just close
      onClose();
    }
    // Fast flick or large drag up
    else if (velocity < -0.5 || deltaY < -100) {
      if (snap === "half") onExpandFull();
    }
    // Otherwise snap back (no-op)
  }, [snap, onClose, onExpandFull]);

  if (snap === "closed") return null;

  return (
    <>
      <div className="m-bottom-sheet__backdrop" onClick={onClose} />
      <div
        className={`m-bottom-sheet m-bottom-sheet--${snap}`}
        style={{
          height: SNAP_HEIGHTS[snap],
          transform: dragOffset !== 0 ? `translateY(${Math.max(0, dragOffset)}px)` : undefined,
          transition: dragOffset !== 0 ? 'none' : undefined,
        }}
        role="dialog"
        aria-modal="true"
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="m-bottom-sheet__handle" onTouchStart={handleDragStart}>
          <div className="m-bottom-sheet__handle-bar" />
        </div>
        <div className="m-bottom-sheet__body">
          {snap === "half" ? halfContent : fullContent}
        </div>
      </div>
    </>
  );
}
