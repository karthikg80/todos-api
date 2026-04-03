/**
 * ProjectComplexityIndicator
 *
 * A lightweight badge showing the project's complexity level:
 * - Simple project (green)
 * - Structured project (blue)
 * - Complex project (orange)
 *
 * This helps users understand why they're seeing Overview-first,
 * Sections-first, or Tasks-first behavior.
 */

import type { Todo, Heading } from "../../types";
import {
  classifyProjectComplexity,
  COMPLEXITY_LABELS,
  COMPLEXITY_LEVELS,
  type ComplexityLevel,
} from "../../utils/projectComplexity";

interface ProjectComplexityIndicatorProps {
  todos: Todo[];
  projectId: string | null | undefined;
  headings: Heading[];
}

const COMPLEXITY_STYLES: Record<
  ComplexityLevel,
  { background: string; border: string; color: string; icon: string }
> = {
  [COMPLEXITY_LEVELS.SIMPLE]: {
    background: "color-mix(in oklab, var(--success) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--success) 20%, transparent)",
    color: "var(--success)",
    icon: "●",
  },
  [COMPLEXITY_LEVELS.STRUCTURED]: {
    background: "color-mix(in oklab, var(--info) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--info) 20%, transparent)",
    color: "var(--info)",
    icon: "◆",
  },
  [COMPLEXITY_LEVELS.COMPLEX]: {
    background: "color-mix(in oklab, var(--warning) 8%, transparent)",
    border: "1px solid color-mix(in oklab, var(--warning) 20%, transparent)",
    color: "var(--warning)",
    icon: "▲",
  },
};

export function ProjectComplexityIndicator({
  todos,
  projectId,
  headings,
}: ProjectComplexityIndicatorProps) {
  if (!projectId) return null;

  const complexity = classifyProjectComplexity(todos, projectId, headings);
  const styles = COMPLEXITY_STYLES[complexity];
  const label = COMPLEXITY_LABELS[complexity];

  return (
    <div
      className="project-complexity-indicator"
      style={{
        background: styles.background,
        border: styles.border,
        color: styles.color,
      }}
    >
      <span
        className="project-complexity-indicator__icon"
        aria-hidden="true"
      >
        {styles.icon}
      </span>
      <span className="project-complexity-indicator__label">{label}</span>
    </div>
  );
}
