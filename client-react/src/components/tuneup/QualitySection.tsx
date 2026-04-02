import { useState } from "react";
import type { QualityIssue } from "../../types/tuneup";

interface Props {
  issues: QualityIssue[];
  dismissed: Set<string>;
  patchedTaskIds: Set<string>;
  onEditTitle: (taskId: string, newTitle: string) => void;
  onDismiss: (key: string) => void;
}

function AllClear() {
  return (
    <div className="tuneup-all-clear">
      <span className="tuneup-all-clear__icon" aria-hidden="true">✓</span>
      All clear
    </div>
  );
}

function QualityRow({
  issue,
  onEditTitle,
  onDismiss,
}: {
  issue: QualityIssue;
  onEditTitle: (taskId: string, newTitle: string) => void;
  onDismiss: (key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(issue.title);

  function commitEdit() {
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === issue.title) {
      setDraft(issue.title);
      setEditing(false);
      return;
    }
    onEditTitle(issue.id, trimmed);
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setDraft(issue.title);
      setEditing(false);
    }
  }

  return (
    <div className="tuneup-row">
      {editing ? (
        <input
          className="tuneup-row__edit-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div className="tuneup-row__title">
          {issue.title}
          <div style={{ display: "flex", gap: "4px", marginTop: "2px", flexWrap: "wrap" }}>
            {issue.issues.map((tag) => (
              <span key={tag} className="tuneup-tag">
                {tag}
              </span>
            ))}
          </div>
          {issue.suggestions.length > 0 && (
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
              {issue.suggestions[0]}
            </div>
          )}
        </div>
      )}
      <div className="tuneup-row__actions">
        {!editing && (
          <button
            type="button"
            className="tuneup-row__btn"
            onClick={() => {
              setDraft(issue.title);
              setEditing(true);
            }}
          >
            Edit
          </button>
        )}
        <button
          type="button"
          className="tuneup-row__btn"
          onClick={() => onDismiss(`quality:${issue.id}`)}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function QualitySection({
  issues,
  dismissed,
  patchedTaskIds,
  onEditTitle,
  onDismiss,
}: Props) {
  const visible = issues.filter(
    (r) => !dismissed.has(`quality:${r.id}`) && !patchedTaskIds.has(r.id),
  );

  if (visible.length === 0) return <AllClear />;

  return (
    <div className="tuneup-section__list">
      {visible.map((issue) => (
        <QualityRow
          key={issue.id}
          issue={issue}
          onEditTitle={onEditTitle}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}
