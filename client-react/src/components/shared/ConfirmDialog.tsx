import { useEffect, useRef, useState } from "react";

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
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") animateOut(onCancel);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const animateOut = (callback: () => void) => {
    setExiting(true);
    setTimeout(callback, 150);
  };

  return (
    <div
      id="confirmDialog"
      className={`confirm-overlay${exiting ? " confirm-overlay--exiting" : ""}`}
      onClick={() => animateOut(onCancel)}
    >
      <div
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
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
