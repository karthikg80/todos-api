import { useRef, useState } from "react";
import { useOverlayFocusTrap } from "./useOverlayFocusTrap";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: Props) {
  const okRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [exiting, setExiting] = useState(false);

  const animateOut = (callback: () => void) => {
    setExiting(true);
    setTimeout(callback, 150);
  };

  useOverlayFocusTrap({
    isOpen: true,
    containerRef: dialogRef,
    onClose: () => animateOut(onCancel),
    initialFocusRef: okRef,
  });

  return (
    <div
      id="confirmDialog"
      className={`confirm-overlay${exiting ? " confirm-overlay--exiting" : ""}`}
      onClick={() => animateOut(onCancel)}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmDialogTitle"
      >
        <div id="confirmDialogTitle" className="confirm-dialog__title">
          {title}
        </div>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <button className="btn" onClick={() => animateOut(onCancel)}>
            Cancel
          </button>
          <button
            id="confirmDialogOk"
            className="btn btn--danger"
            onClick={() => animateOut(onConfirm)}
            ref={okRef}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
