import type { Priority, Project, TaskStatus } from "../types";

export type PlannerMode = "suggest" | "apply";

export type PlannerTaskStatus =
  | "next"
  | "in_progress"
  | "waiting"
  | "scheduled"
  | "someday";

export type PlannerRecommendationType =
  | "create_next_action"
  | "review_stale_task"
  | "follow_up_waiting_task"
  | "plan_project";

export type PlannerFindingType =
  | "missing_next_action"
  | "stale_task"
  | "waiting_task"
  | "upcoming_deadline"
  | "empty_active_project";

export interface PlannerTaskSuggestion {
  title: string;
  description?: string | null;
  priority?: Priority | null;
  status?: PlannerTaskStatus;
  reason: string;
}

export interface PlanProjectInput {
  userId: string;
  projectId: string;
  goal?: string | null;
  constraints?: string[];
  mode?: PlannerMode;
}

export interface PlanProjectResult {
  project: Pick<Project, "id" | "name">;
  summary: string;
  suggestedTasks: PlannerTaskSuggestion[];
  createdTaskIds: string[];
}

export interface EnsureNextActionInput {
  userId: string;
  projectId: string;
  mode?: PlannerMode;
}

export interface PlannerTaskReference {
  id: string | null;
  title: string;
  status: Extract<TaskStatus, "next" | "in_progress">;
}

export interface EnsureNextActionResult {
  projectId: string;
  hasNextAction: boolean;
  created: boolean;
  task: PlannerTaskReference | null;
  reason: string;
}

export interface WeeklyReviewInput {
  userId: string;
  mode?: PlannerMode;
  includeArchived?: boolean;
}

export interface WeeklyReviewSummary {
  projectsWithoutNextAction: number;
  staleTasks: number;
  waitingTasks: number;
  upcomingTasks: number;
}

export interface WeeklyReviewFinding {
  type: PlannerFindingType;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  reason: string;
}

export interface WeeklyReviewAction {
  type: PlannerRecommendationType;
  projectId?: string;
  taskId?: string;
  title: string;
  reason: string;
  createdTaskId?: string;
}

export interface WeeklyReviewResult {
  summary: WeeklyReviewSummary;
  findings: WeeklyReviewFinding[];
  recommendedActions: WeeklyReviewAction[];
  appliedActions: WeeklyReviewAction[];
}
