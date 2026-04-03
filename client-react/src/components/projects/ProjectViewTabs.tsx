/**
 * ProjectViewTabs
 *
 * Tab navigation for projects with three views:
 * - Overview: Best for deciding what to do next
 * - Sections: Best when the project has distinct phases
 * - Tasks: Best for sorting, batching, and bulk edits
 *
 * The default tab is automatically selected based on project complexity.
 */

import type { Todo, Heading } from "../../types";
import {
  getDefaultTabForProject,
  TAB_LABELS,
  TAB_DESCRIPTIONS,
  type ProjectTab,
} from "../../utils/projectComplexity";

interface ProjectViewTabsProps {
  todos: Todo[];
  projectId: string | null | undefined;
  headings: Heading[];
  activeTab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}

export function ProjectViewTabs({
  todos,
  projectId,
  headings,
  activeTab,
  onTabChange,
}: ProjectViewTabsProps) {
  if (!projectId) return null;

  const defaultTab = getDefaultTabForProject(todos, projectId, headings);
  const description = TAB_DESCRIPTIONS[activeTab];

  return (
    <>
      <div className="project-view-tabs" role="tablist" aria-label="Project view tabs">
        {Object.entries(TAB_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`project-view-tab project-view-tab--${key}${
              activeTab === key ? " project-view-tab--active" : ""
            }`}
            data-tab={key}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls="projectViewContent"
            onClick={() => onTabChange(key as ProjectTab)}
          >
            <span className="project-view-tab__label">{label}</span>
          </button>
        ))}
      </div>

      {description && (
        <div className="project-tab-description" aria-live="polite">
          {description}
        </div>
      )}
    </>
  );
}
