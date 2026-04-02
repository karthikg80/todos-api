import { taxSimilarKey } from "../../utils/topFinding";
import type { SimilarProjectPair, SmallProject } from "../../types/tuneup";

interface Props {
  similarProjects: SimilarProjectPair[];
  smallProjects: SmallProject[];
  dismissed: Set<string>;
  patchedProjectIds: Set<string>;
  onArchiveProject: (projectId: string) => void;
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

export function TaxonomySection({
  similarProjects,
  smallProjects,
  dismissed,
  patchedProjectIds,
  onArchiveProject,
  onDismiss,
}: Props) {
  const visibleSimilar = similarProjects.filter((p) => {
    const key = taxSimilarKey(p.projectAId, p.projectBId, p.projectAName, p.projectBName);
    return !dismissed.has(key);
  });

  const visibleSmall = smallProjects.filter(
    (p) => !(p.id ? dismissed.has(`tax:low:${p.id}`) || patchedProjectIds.has(p.id) : false),
  );

  if (visibleSimilar.length === 0 && visibleSmall.length === 0) {
    return <AllClear />;
  }

  return (
    <div className="tuneup-section__list">
      {visibleSimilar.map((pair) => {
        const key = taxSimilarKey(pair.projectAId, pair.projectBId, pair.projectAName, pair.projectBName);
        return (
          <div key={key} className="tuneup-row">
            <div className="tuneup-row__title">
              "{pair.projectAName}" and "{pair.projectBName}" look similar
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
                Consider merging these projects
              </div>
            </div>
            <div className="tuneup-row__actions">
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
      {visibleSmall.map((project) => {
        const dismissKey = project.id ? `tax:low:${project.id}` : `tax:low:name:${project.name}`;
        return (
          <div key={dismissKey} className="tuneup-row">
            <div className="tuneup-row__title">
              "{project.name}" has only {project.taskCount} task
              {project.taskCount !== 1 ? "s" : ""}
              <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
                Consider archiving or merging into another project
              </div>
            </div>
            <div className="tuneup-row__actions">
              {project.id && (
                <button
                  type="button"
                  className="tuneup-row__btn tuneup-row__btn--danger"
                  onClick={() => onArchiveProject(project.id!)}
                >
                  Archive
                </button>
              )}
              <button
                type="button"
                className="tuneup-row__btn"
                onClick={() => onDismiss(dismissKey)}
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
