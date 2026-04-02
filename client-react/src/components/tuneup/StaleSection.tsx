import type { StaleTask, StaleProject } from "../../types/tuneup";

interface Props {
  staleTasks: StaleTask[];
  staleProjects: StaleProject[];
  dismissed: Set<string>;
  patchedTaskIds: Set<string>;
  patchedProjectIds: Set<string>;
  onArchiveTask: (taskId: string) => void;
  onSnoozeTask: (taskId: string) => void;
  onArchiveProject: (projectId: string) => void;
  onDismiss: (key: string) => void;
  onOpenTask: (taskId: string) => void;
}

function AllClear() {
  return (
    <div className="tuneup-all-clear">
      <span className="tuneup-all-clear__icon" aria-hidden="true">✓</span>
      All clear
    </div>
  );
}

function daysAgo(lastUpdated?: string): string {
  if (!lastUpdated) return "unknown";
  const days = Math.floor(
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days <= 0) return "today";
  return `${days}d ago`;
}

export function StaleSection({
  staleTasks,
  staleProjects,
  dismissed,
  patchedTaskIds,
  patchedProjectIds,
  onArchiveTask,
  onSnoozeTask,
  onArchiveProject,
  onDismiss,
  onOpenTask,
}: Props) {
  const visibleTasks = staleTasks.filter(
    (t) => !dismissed.has(`stale:task:${t.id}`) && !patchedTaskIds.has(t.id),
  );
  const visibleProjects = staleProjects.filter(
    (p) => !dismissed.has(`stale:project:${p.id}`) && !patchedProjectIds.has(p.id),
  );

  if (visibleTasks.length === 0 && visibleProjects.length === 0) {
    return <AllClear />;
  }

  return (
    <div className="tuneup-section__list">
      {visibleTasks.map((task) => (
        <div key={`stale-task-${task.id}`} className="tuneup-row">
          <div className="tuneup-row__title">
            {task.title}
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
              Last updated {daysAgo(task.lastUpdated)}
              {task.status ? ` \u00b7 ${task.status}` : ""}
            </div>
          </div>
          <div className="tuneup-row__actions">
            <button
              type="button"
              className="tuneup-row__btn"
              onClick={() => onOpenTask(task.id)}
            >
              Open
            </button>
            <button
              type="button"
              className="tuneup-row__btn"
              onClick={() => onSnoozeTask(task.id)}
            >
              Snooze 30d
            </button>
            <button
              type="button"
              className="tuneup-row__btn tuneup-row__btn--danger"
              onClick={() => onArchiveTask(task.id)}
            >
              Archive
            </button>
            <button
              type="button"
              className="tuneup-row__btn"
              onClick={() => onDismiss(`stale:task:${task.id}`)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
      {visibleProjects.map((project) => (
        <div key={`stale-project-${project.id}`} className="tuneup-row">
          <div className="tuneup-row__title">
            {project.name}
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--muted)", marginTop: "2px" }}>
              Project \u00b7 Last updated {daysAgo(project.lastUpdated)}
            </div>
          </div>
          <div className="tuneup-row__actions">
            <button
              type="button"
              className="tuneup-row__btn tuneup-row__btn--danger"
              onClick={() => onArchiveProject(project.id)}
            >
              Archive
            </button>
            <button
              type="button"
              className="tuneup-row__btn"
              onClick={() => onDismiss(`stale:project:${project.id}`)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
