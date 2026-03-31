import { useEffect, useRef } from "react";

export type ToastVariant = "default" | "success" | "error" | "warning";

interface UndoAction {
  message: string;
  onUndo?: () => void;
  variant?: ToastVariant;
}

interface Props {
  action: UndoAction | null;
  onDismiss: () => void;
}

export function UndoToast({ action, onDismiss }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!action) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timerRef.current);
  }, [action, onDismiss]);

  const variant = action?.variant || "default";

  return (
    <div
      id="undoToast"
      className={`undo-toast${action ? " active" : ""} undo-toast--${variant}`}
    >
      <span id="undoMessage" className="undo-toast__message">
        {action?.message}
      </span>
      {action?.onUndo && (
        <button
          className="undo-toast__btn"
          onClick={() => {
            action.onUndo?.();
            onDismiss();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
