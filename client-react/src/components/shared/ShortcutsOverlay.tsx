import { useEffect } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { keys: "⌘/Ctrl + K", description: "Open command palette" },
  { keys: "n", description: "New task" },
  { keys: "/", description: "Focus search" },
  { keys: "j / k", description: "Navigate tasks up/down" },
  { keys: "x", description: "Toggle completion" },
  { keys: "e", description: "Open task details" },
  { keys: "d", description: "Delete task" },
  { keys: "Escape", description: "Close drawer / cancel" },
  { keys: "?", description: "Show keyboard shortcuts" },
];

export function ShortcutsOverlay({ isOpen, onClose }: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="shortcutsOverlay"
      className="shortcuts-overlay"
      onClick={onClose}
    >
      <div
        className="shortcuts-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="shortcuts-dialog__header">
          <h2 className="shortcuts-dialog__title">Keyboard Shortcuts</h2>
          <button className="todo-drawer__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shortcuts-dialog__body">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="shortcut-row">
              <kbd className="shortcut-key">{s.keys}</kbd>
              <span className="shortcut-desc">{s.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
