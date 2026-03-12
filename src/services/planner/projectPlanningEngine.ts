import type { Project, Todo } from "../../types";
import type { PlannerTaskSuggestion } from "../../types/plannerTypes";
import {
  buildProjectPlan,
  deriveNextAction,
  findExistingNextAction,
} from "./plannerHeuristics";

export class ProjectPlanningEngine {
  planProject(input: {
    project: Project;
    tasks: Todo[];
    goal: string;
    constraints: string[];
  }): PlannerTaskSuggestion[] {
    return buildProjectPlan(input);
  }

  ensureNextAction(input: { project: Project; tasks: Todo[] }): {
    existingTask: Todo | null;
    suggestion: PlannerTaskSuggestion | null;
  } {
    const existingTask = findExistingNextAction(input.tasks);
    if (existingTask) {
      return {
        existingTask,
        suggestion: null,
      };
    }

    return {
      existingTask: null,
      suggestion: deriveNextAction(input.project, input.tasks),
    };
  }
}
