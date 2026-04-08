import type { Project } from "../../types";
import type { ProjectEditorDefaultView } from "./projectEditorModels";

interface Props {
  goal: string;
  onGoalChange: (value: string) => void;
  targetDate: string;
  onTargetDateChange: (value: string) => void;
  projectStatus: Project["status"];
  onProjectStatusChange: (value: Project["status"]) => void;
  defaultView: ProjectEditorDefaultView;
  onDefaultViewChange: (value: ProjectEditorDefaultView) => void;
  projectDirty: boolean;
  saving: boolean;
  onSaveProject: () => void;
  onArchiveProject: () => void;
}

export function ProjectEditorSettingsCard({
  goal,
  onGoalChange,
  targetDate,
  onTargetDateChange,
  projectStatus,
  onProjectStatusChange,
  defaultView,
  onDefaultViewChange,
  projectDirty,
  saving,
  onSaveProject,
  onArchiveProject,
}: Props) {
  return (
    <div className="project-editor__settings-column">
      <div className="project-editor__settings-card">
        <div className="project-editor__settings-title">Project settings</div>
        <label className="project-editor__field-label" htmlFor="projectEditorGoal">
          Goal
        </label>
        <textarea
          id="projectEditorGoal"
          className="project-editor__textarea"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="What “done” looks like…"
          aria-describedby="projectEditorGoalHint"
        />
        <span id="projectEditorGoalHint" className="sr-only">
          Planning notes for this project; the short description lives in the header card.
        </span>
        <label className="project-editor__field-label" htmlFor="projectEditorTarget">
          Target timeframe
        </label>
        <input
          id="projectEditorTarget"
          type="date"
          className="project-editor__input"
          value={targetDate}
          onChange={(e) => onTargetDateChange(e.target.value)}
        />
        <label
          className="project-editor__field-label"
          htmlFor="projectEditorStatus"
          style={{ marginTop: "0.75rem" }}
        >
          Status
        </label>
        <select
          id="projectEditorStatus"
          className="project-editor__select"
          value={projectStatus}
          onChange={(e) =>
            onProjectStatusChange(e.target.value as Project["status"])
          }
        >
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <label
          className="project-editor__field-label"
          htmlFor="projectEditorDefaultView"
          style={{ marginTop: "0.75rem" }}
        >
          Default view
        </label>
        <select
          id="projectEditorDefaultView"
          className="project-editor__select"
          aria-label="Default view"
          value={defaultView}
          onChange={(e) =>
            onDefaultViewChange(e.target.value as ProjectEditorDefaultView)
          }
          title="Stored only in this browser (localStorage), not on the server."
        >
          <option value="editor">Single page editor</option>
          <option value="list">Task list</option>
          <option value="board">Board</option>
        </select>
        <p
          className="project-editor__field-label"
          style={{ marginTop: "0.5rem", fontSize: "0.75rem" }}
        >
          Default view is local-only (per browser) until a server preference exists.
        </p>
      </div>
      <div className="project-editor__actions-row">
        <button
          type="button"
          className="btn btn--primary"
          id="projectEditorSaveButton"
          disabled={!projectDirty || saving}
          onClick={onSaveProject}
        >
          {saving ? "Saving…" : "Save project"}
        </button>
        <button type="button" className="btn" onClick={onArchiveProject}>
          Archive
        </button>
      </div>
    </div>
  );
}
