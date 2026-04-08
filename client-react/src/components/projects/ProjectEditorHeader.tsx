import type { RefObject } from "react";
import type { ProjectEditorStats } from "./projectEditorModels";
import { projectStatusLabel } from "./projectEditorModels";
import type { Project } from "../../types";
import { ProjectKebabMenu } from "./ProjectKebabMenu";

interface Props {
  project: Project;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  stats: ProjectEditorStats;
  titleInputRef?: RefObject<HTMLInputElement | null>;
  onRenameMenu: () => void;
  onArchiveProject: () => void;
  onDeleteProject: () => void;
}

export function ProjectEditorHeader({
  project,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  stats,
  titleInputRef,
  onRenameMenu,
  onArchiveProject,
  onDeleteProject,
}: Props) {
  return (
    <div className="project-editor__header-main">
      <div>
        <div className="project-editor__eyebrow">Project editor</div>
        <div className="project-editor__title-row">
          <input
            ref={titleInputRef}
            id="projectEditorTitleInput"
            className="project-editor__title-input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Project name"
          />
          <span
            className="project-editor__pill project-editor__pill--success"
            title="Project status"
          >
            {projectStatusLabel(project.status)}
          </span>
          {project.area?.trim() ? (
            <span className="project-editor__pill">{project.area}</span>
          ) : null}
          <ProjectKebabMenu
            onRename={onRenameMenu}
            onArchive={onArchiveProject}
            onDelete={onDeleteProject}
          />
        </div>
      </div>

      <label className="project-editor__field-label" htmlFor="projectEditorDescription">
        Description
      </label>
      <textarea
        id="projectEditorDescription"
        className="project-editor__desc-input"
        value={description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        placeholder="What this project is for…"
      />

      <div className="project-editor__stats">
        <div className="project-editor__stat">
          <span className="project-editor__stat-label">Open tasks</span>
          <span className="project-editor__stat-value">{stats.openCount}</span>
        </div>
        <div className="project-editor__stat">
          <span className="project-editor__stat-label">Completed</span>
          <span className="project-editor__stat-value">{stats.completedCount}</span>
        </div>
        <div className="project-editor__stat">
          <span className="project-editor__stat-label">Next step</span>
          <span className="project-editor__stat-value">{stats.nextStepTitle}</span>
        </div>
        <div className="project-editor__stat">
          <span className="project-editor__stat-label">Progress</span>
          <span className="project-editor__stat-value">{stats.progressLabel}</span>
        </div>
      </div>
    </div>
  );
}
