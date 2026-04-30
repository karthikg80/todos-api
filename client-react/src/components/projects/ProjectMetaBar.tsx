import type { Project } from "../../types";
import { Field } from "../shared/Field";

export interface ProjectMetaBarProps {
  description: string;
  onDescriptionChange: (value: string) => void;
  goal: string;
  onGoalChange: (value: string) => void;
  area: string;
  onAreaChange: (value: string) => void;
  areaSuggestions: string[];
  priority: Project["priority"] | null;
  onPriorityChange: (value: Project["priority"] | null) => void;
  targetDate: string;
  onTargetDateChange: (value: string) => void;
  status: Project["status"];
  onStatusChange: (value: Project["status"]) => void;
  saving: boolean;
  dirty: boolean;
  isDraft?: boolean;
  hasName: boolean;
  onSave: () => void;
}

export function ProjectMetaBar({
  description,
  onDescriptionChange,
  goal,
  onGoalChange,
  area,
  onAreaChange,
  areaSuggestions,
  priority,
  onPriorityChange,
  targetDate,
  onTargetDateChange,
  status,
  onStatusChange,
  saving,
  dirty,
  isDraft,
  hasName,
  onSave,
}: ProjectMetaBarProps) {
  return (
    <section className="project-page__settings project-meta-bar">
      <Field label="Description" htmlFor="projectMetaDescription">
        <textarea
          id="projectMetaDescription"
          className="project-page__textarea"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="What this project is about"
        />
      </Field>
      <Field label="Goal" htmlFor="projectMetaGoal">
        <textarea
          id="projectMetaGoal"
          className="project-page__textarea"
          value={goal}
          onChange={(event) => onGoalChange(event.target.value)}
          placeholder="What done looks like"
        />
      </Field>
      <Field label="Area" htmlFor="projectMetaArea">
        <input
          id="projectMetaArea"
          list="project-area-options"
          className="project-page__input"
          value={area}
          onChange={(event) => onAreaChange(event.target.value)}
          placeholder="Home, Work, Health…"
        />
        <datalist id="project-area-options">
          {areaSuggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </Field>
      <Field label="Priority" htmlFor="projectMetaPriority">
        <select
          id="projectMetaPriority"
          className="project-page__input"
          value={priority ?? ""}
          onChange={(event) =>
            onPriorityChange(
              event.target.value
                ? (event.target.value as NonNullable<Project["priority"]>)
                : null,
            )
          }
        >
          <option value="">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </Field>
      <Field label="Target date" htmlFor="projectMetaTargetDate">
        <input
          id="projectMetaTargetDate"
          type="date"
          className="project-page__input"
          value={targetDate}
          onChange={(event) => onTargetDateChange(event.target.value)}
        />
      </Field>
      <Field label="Status" htmlFor="projectMetaStatus">
        <select
          id="projectMetaStatus"
          className="project-page__input"
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value as Project["status"])
          }
        >
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </Field>
      <div className="project-page__settings-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={onSave}
          disabled={!dirty || saving || !hasName}
        >
          {saving ? "Saving…" : isDraft ? "Create project" : "Save project"}
        </button>
      </div>
    </section>
  );
}
