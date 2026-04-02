import { useRef, useCallback, type ReactNode } from "react";
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

  const handleDragStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleDragEnd = useCallback((e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - dragStartY.current;
    if (deltaY > 60) onClose();
    else if (deltaY < -60 && snap === "half") onExpandFull();
  }, [snap, onClose, onExpandFull]);

  if (snap === "closed") return null;

  return (
    <>
      <div className="m-bottom-sheet__backdrop" onClick={onClose} />
      <div
        className={`m-bottom-sheet m-bottom-sheet--${snap}`}
        style={{ height: SNAP_HEIGHTS[snap] }}
        role="dialog"
        aria-modal="true"
      >
        <div className="m-bottom-sheet__handle" onTouchStart={handleDragStart} onTouchEnd={handleDragEnd}>
          <div className="m-bottom-sheet__handle-bar" />
        </div>
        <div className="m-bottom-sheet__body">
          {snap === "half" ? halfContent : fullContent}
        </div>
      </div>
    </>
  );
}
