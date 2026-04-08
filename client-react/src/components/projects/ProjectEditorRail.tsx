import { useState } from "react";
import type { Heading, Todo } from "../../types";
import {
  PROJECT_RAIL_BACKLOG_SENTINEL,
  sectionRowsForRail,
} from "./projectEditorModels";

interface Props {
  headings: Heading[];
  projectTodos: Todo[];
  activeHeadingId: string | null;
  onSelectHeading: (id: string | null) => void;
  onAddHeading: (name: string) => Promise<unknown>;
}

export function ProjectEditorRail({
  headings,
  projectTodos,
  activeHeadingId,
  onSelectHeading,
  onAddHeading,
}: Props) {
  const [newSectionName, setNewSectionName] = useState("");

  const rows = sectionRowsForRail(headings, projectTodos);

  const handleAddSection = async () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    const created = await onAddHeading(trimmed);
    if (created) setNewSectionName("");
  };

  const isAllActive = activeHeadingId === null;

  return (
    <>
      <section className="project-editor__rail">
        <div className="project-editor__rail-head">
          <h2 className="project-editor__rail-title">Structure</h2>
        </div>
        <p className="project-editor__field-label">
          Filter tasks by section. &quot;All tasks&quot; clears the section
          filter.
        </p>
        <div className="project-editor__section-list">
          <button
            type="button"
            className={`project-editor__section-btn${isAllActive ? " project-editor__section-btn--active" : ""}`}
            id="projectEditorFilterAll"
            onClick={() => onSelectHeading(null)}
          >
            <span className="project-editor__stat-value">All tasks</span>
          </button>
          {rows.map((row) => {
            const isBacklog = row.key === PROJECT_RAIL_BACKLOG_SENTINEL;
            const active =
              activeHeadingId === row.key ||
              (isBacklog && activeHeadingId === PROJECT_RAIL_BACKLOG_SENTINEL);
            return (
              <button
                key={row.key}
                type="button"
                className={`project-editor__section-btn${active ? " project-editor__section-btn--active" : ""}`}
                data-section-id={row.key}
                onClick={() => onSelectHeading(row.key)}
              >
                <span>
                  <span className="project-editor__stat-value">
                    {row.label}
                  </span>
                </span>
                <span className="project-editor__section-count">
                  {row.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="project-editor__add-section">
          <input
            type="text"
            className="project-editor__input"
            placeholder="+ Add section"
            value={newSectionName}
            aria-label="New section name"
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddSection();
            }}
          />
        </div>
      </section>
    </>
  );
}
