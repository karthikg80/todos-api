import { dupGroupKey } from "../../utils/topFinding";
import type { DuplicateGroup } from "../../types/tuneup";

interface Props {
  groups: DuplicateGroup[];
  dismissed: Set<string>;
  patchedTaskIds: Set<string>;
  onMerge: (group: DuplicateGroup) => void;
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

export function DuplicatesSection({
  groups,
  dismissed,
  patchedTaskIds,
  onMerge,
  onDismiss,
}: Props) {
  const visible = groups.filter((g) => {
    const key = dupGroupKey(g.tasks.map((t) => t.id));
    return !dismissed.has(key) && !g.tasks.some((t) => patchedTaskIds.has(t.id));
  });

  if (visible.length === 0) return <AllClear />;

  return (
    <div className="tuneup-section__list">
      {visible.map((group) => {
        const key = dupGroupKey(group.tasks.map((t) => t.id));
        const survivor = group.tasks[0];
        const others = group.tasks.slice(1);
        const confidenceLabel =
          group.confidence >= 0.95 ? "Exact" : "Similar";

        return (
          <div key={key} className="tuneup-row">
            <div className="tuneup-row__title">
              <strong>{confidenceLabel}:</strong>{" "}
              {group.tasks.map((t) => t.title).join(", ")}
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
                Keep "{survivor.title}" — archive{" "}
                {others.length} duplicate{others.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="tuneup-row__actions">
              <button
                type="button"
                className="tuneup-row__btn tuneup-row__btn--danger"
                onClick={() => onMerge(group)}
              >
                Merge
              </button>
              <button
                type="button"
                className="tuneup-row__btn"
                onClick={() => onDismiss(key)}
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
