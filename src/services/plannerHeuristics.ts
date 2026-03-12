export {
  buildProjectPlan,
  deriveNextAction,
  findExistingNextAction,
  projectHasNextAction,
  projectTasksForProject,
} from "./planner/plannerHeuristics";

import type { Project, Todo } from "../types";
import { ProjectPlanningEngine } from "./planner/projectPlanningEngine";
import { ReviewEngine } from "./planner/reviewEngine";

export function findWeeklyReviewFindings(input: {
  projects: Project[];
  tasks: Todo[];
  now: Date;
  includeArchived: boolean;
  staleTaskDays: number;
  upcomingDays: number;
}) {
  return new ReviewEngine({
    projectPlanningEngine: new ProjectPlanningEngine(),
  }).weeklyReview(input);
}
