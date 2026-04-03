/**
 * ProjectView
 *
 * A comprehensive project view that integrates:
 * - Project complexity indicator
 * - Project view tabs (Overview, Sections, Tasks)
 * - Next step module for task focus
 * - Enhanced metrics display
 *
 * The UI adapts based on project complexity (simple, structured, complex).
 */

import { useState, useEffect, useCallback } from "react";
import type { Todo, Heading } from "../../types";
import {
  classifyProjectComplexity,
  getDefaultTabForProject,
  type ProjectTab,
  getProjectMetrics,
  getEnhancedMetricsText,
} from "../../utils/projectComplexity";
import { ProjectComplexityIndicator } from "./ProjectComplexityIndicator";
import { ProjectViewTabs } from "./ProjectViewTabs";
import { ProjectNextStep } from "./ProjectNextStep";

interface ProjectViewProps {
  children: React.ReactNode;
  todos: Todo[];
  projectId: string | null | undefined;
  headings: Heading[];
  onStartTask: (todo: Todo) => void;
  onDeferTask: (todo: Todo) => void;
  onReplaceTask: () => void;
}

export function ProjectView({
  children,
  todos,
  projectId,
  headings,
  onStartTask,
  onDeferTask,
  onReplaceTask,
}: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");

  // Load saved tab preference for this project
  useEffect(() => {
    if (!projectId) return;

    const normalized = projectId; // Projects already have unique IDs
    try {
      const tabPreferences = JSON.parse(
        localStorage.getItem("projectTabPreferences") || "{}",
      );
      const savedTab = tabPreferences[normalized];
      if (savedTab && ["overview", "sections", "tasks"].includes(savedTab)) {
        setActiveTab(savedTab as ProjectTab);
      } else {
        // Use default tab based on complexity
        const defaultTab = getDefaultTabForProject(todos, projectId, headings);
        setActiveTab(defaultTab);
      }
    } catch (e) {
      // Use default tab
      const defaultTab = getDefaultTabForProject(todos, projectId, headings);
      setActiveTab(defaultTab);
    }
  }, [projectId, todos, headings]);

  // Save tab preference when it changes
  const handleTabChange = useCallback(
    (tab: ProjectTab) => {
      setActiveTab(tab);

      if (projectId) {
        try {
          const tabPreferences = JSON.parse(
            localStorage.getItem("projectTabPreferences") || "{}",
          );
          tabPreferences[projectId] = tab;
          localStorage.setItem(
            "projectTabPreferences",
            JSON.stringify(tabPreferences),
          );
        } catch (e) {
          console.error("Failed to save tab preference:", e);
        }
      }

      // Emit event for other components to respond
      window.dispatchEvent(
        new CustomEvent("projectTabChanged", {
          detail: { tab, project: projectId },
        }),
      );
    },
    [projectId],
  );

  const complexity = classifyProjectComplexity(todos, projectId, headings);
  const metrics = getProjectMetrics(todos, projectId);
  const enhancedMetricsText = getEnhancedMetricsText(metrics);

  return (
    <div className="project-view">
      <ProjectComplexityIndicator
        todos={todos}
        projectId={projectId}
        headings={headings}
      />

      <ProjectViewTabs
        todos={todos}
        projectId={projectId}
        headings={headings}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      <ProjectNextStep
        todos={todos}
        projectId={projectId}
        onStartTask={onStartTask}
        onDeferTask={onDeferTask}
        onReplaceTask={onReplaceTask}
      />

      {/* Enhanced metrics bar (optional, can be shown in header) */}
      {enhancedMetricsText && (
        <div className="project-metrics-bar">
          {enhancedMetricsText}
        </div>
      )}

      {/* Main content area */}
      <div
        className={`project-view__content project-view__content--${activeTab}`}
        data-project-tab={activeTab}
      >
        {children}
      </div>
    </div>
  );
}
