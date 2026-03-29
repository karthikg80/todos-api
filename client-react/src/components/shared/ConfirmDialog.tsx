import { useEffect, useRef } from "react";

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

  useEffect(() => {
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div id="confirmDialog" className="confirm-overlay" onClick={onCancel}>
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
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            id="confirmDialogOk"
            className="btn btn--danger"
            onClick={onConfirm}
            ref={okRef}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
