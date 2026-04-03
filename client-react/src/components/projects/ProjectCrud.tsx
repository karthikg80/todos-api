import { useState, useRef, useEffect } from "react";
import { apiCall } from "../../api/client";
import { useOverlayFocusTrap } from "../shared/useOverlayFocusTrap";

interface Props {
  mode: "create" | "rename";
  currentName?: string;
  projectId?: string;
  onDone: () => void;
  onCancel: () => void;
}

export function ProjectCrud({
  mode,
  currentName = "",
  projectId,
  onDone,
  onCancel,
}: Props) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useOverlayFocusTrap({
    isOpen: true,
    containerRef: dialogRef,
    onClose: onCancel,
    initialFocusRef: inputRef,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");

    try {
      const url =
        mode === "create" ? "/projects" : `/projects/${projectId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await apiCall(url, {
        method,
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        onDone();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          (data as { error?: string }).error || "Failed to save project",
        );
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div id="projectCrudModal" className="confirm-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Create project" : "Rename project"}
      >
        <div className="confirm-dialog__title">
          {mode === "create" ? "New Project" : "Rename Project"}
        </div>
        <input
          id="projectCrudNameInput"
          ref={inputRef}
          className="settings-field__input"
          type="text"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") onCancel();
          }}
        />
        {error && <p style={{ color: "var(--danger)", fontSize: "var(--fs-meta)" }}>{error}</p>}
        <div className="confirm-dialog__actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            id="projectCrudSubmitButton"
            className="btn"
            style={{
              background: "var(--accent)",
              color: "#fff",
              borderColor: "var(--accent)",
            }}
            onClick={handleSubmit}
            disabled={!name.trim() || saving}
          >
            {saving ? "Saving…" : mode === "create" ? "Create" : "Rename"}
          </button>
        </div>
      </div>
    </div>
  );
}
