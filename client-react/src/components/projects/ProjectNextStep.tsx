/**
 * ProjectNextStep
 *
 * A "what's next" module that helps users focus on the most important task.
 *
 * Features:
 * - Shows the next recommended task with a primary CTA button
 * - Displays estimated effort (e.g., "15 min", "Quick win")
 * - Explains why it's next (e.g., "Unblocks sorting work", "due soon")
 * - Provides quick defer and replace actions
 */

import type { Todo } from "../../types";
import {
  findNextTaskForProject,
  estimateTaskEffort,
} from "../../utils/projectComplexity";

interface ProjectNextStepProps {
  todos: Todo[];
  projectId: string | null | undefined;
  onStartTask: (todo: Todo) => void;
  onDeferTask: (todo: Todo) => void;
  onReplaceTask: () => void;
}

export function ProjectNextStep({
  todos,
  projectId,
  onStartTask,
  onDeferTask,
  onReplaceTask,
}: ProjectNextStepProps) {
  if (!projectId) return null;

  const nextStep = findNextTaskForProject(todos, projectId);

  if (!nextStep || !nextStep.todo) {
    return (
      <div className="project-next-step project-next-step--empty">
        <div className="project-next-step__content">
          <div className="project-next-step__label">What's next</div>
          <div className="project-next-step__empty-state">
            No tasks available
          </div>
        </div>
      </div>
    );
  }

  const { todo, effort, reason } = nextStep;

  return (
    <div className="project-next-step">
      <div className="project-next-step__content">
        <div className="project-next-step__primary">
          <div className="project-next-step__label">What's next</div>
          <button
            type="button"
            className="project-next-step__button"
            onClick={() => onStartTask(todo)}
          >
            <span className="project-next-step__button-text">
              {todo.title || "Start next step"}
            </span>
            <span className="project-next-step__button-effort">
              {effort.label}
            </span>
          </button>
        </div>
        {reason && (
          <div className="project-next-step__reason">{reason}</div>
        )}
      </div>
      <div className="project-next-step__actions">
        <button
          type="button"
          className="mini-btn mini-btn--ghost"
          onClick={() => onDeferTask(todo)}
          aria-label="Defer this task to tomorrow"
        >
          Defer
        </button>
        <button
          type="button"
          className="mini-btn mini-btn--ghost"
          onClick={onReplaceTask}
          aria-label="Pick a different task"
        >
          Pick another
        </button>
      </div>
    </div>
  );
}
