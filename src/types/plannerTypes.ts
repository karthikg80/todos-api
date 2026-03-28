import type { Energy, Priority, Project, TaskStatus } from "../types";

export type PlannerMode = "suggest" | "apply";

export type PlannerTaskStatus =
  | "next"
  | "in_progress"
  | "waiting"
  | "scheduled"
  | "someday";

export type PlannerRecommendationType =
  | "create_next_action"
  | "review_task"
  | "review_stale_task"
  | "follow_up_waiting_task"
  | "plan_project"
  | "review_project";

export type PlannerFindingType =
  | "missing_next_action"
  | "stale_task"
  | "waiting_task"
  | "upcoming_deadline"
  | "empty_active_project"
  | "blocked_task";

export type PlannerImpact = "low" | "medium" | "high";
export type PlannerEffort = "low" | "medium" | "high";

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

export interface PlannerFinding {
  type: PlannerFindingType;
  projectId?: string;
  projectName?: string;
  taskId?: string;
  taskTitle?: string;
  reason: string;
}

export interface PlannerRecommendation {
  type: PlannerRecommendationType;
  projectId?: string;
  taskId?: string;
  title: string;
  reason: string;
}

export interface WeeklyReviewAction extends PlannerRecommendation {
  createdTaskId?: string;
}

export interface WeeklyReviewRolloverGroup {
  key: "do" | "defer" | "shrink" | "drop";
  title: string;
  items: Array<{
    taskId: string;
    title: string;
    reason: string;
  }>;
}

export interface WeeklyReviewAnchorSuggestion {
  taskId: string;
  title: string;
  reason: string;
}

export type WeeklyReviewFinding = PlannerFinding;

export interface WeeklyReviewResult {
  summary: WeeklyReviewSummary;
  findings: WeeklyReviewFinding[];
  recommendedActions: WeeklyReviewAction[];
  appliedActions: WeeklyReviewAction[];
  rolloverGroups: WeeklyReviewRolloverGroup[];
  anchorSuggestions: WeeklyReviewAnchorSuggestion[];
  behaviorAdjustment: string;
  reflectionSummary?: string | null;
}

export interface DecideNextWorkInput {
  userId: string;
  availableMinutes?: number | null;
  energy?: Energy | null;
  context?: string[];
  mode?: PlannerMode;
  weights?: { priority?: number; dueDate?: number; energyMatch?: number };
  goalIndex?: Map<string, { targetDate: Date | null }>;
  projectGoalMap?: Map<string, string>;
}

export interface DecideNextWorkRecommendation {
  taskId: string;
  projectId?: string | null;
  title: string;
  reason: string;
  impact: PlannerImpact;
  effort: PlannerEffort;
}

export interface DecideNextWorkResult {
  recommendedTasks: DecideNextWorkRecommendation[];
}

export interface AnalyzeProjectHealthInput {
  userId: string;
  projectId: string;
}

export interface AnalyzeProjectHealthIntervention extends PlannerRecommendation {}

export interface AnalyzeProjectHealthResult {
  projectId: string;
  healthScore: number;
  risks: string[];
  recommendedInterventions: AnalyzeProjectHealthIntervention[];
}

export interface AnalyzeWorkGraphInput {
  userId: string;
  projectId: string;
}

export interface WorkGraphTaskNode {
  taskId: string;
  title: string;
  dependsOnTaskIds: string[];
  reason: string;
}

export interface AnalyzeWorkGraphResult {
  blockedTasks: WorkGraphTaskNode[];
  unblockedTasks: WorkGraphTaskNode[];
  criticalPath: WorkGraphTaskNode[];
  parallelWork: WorkGraphTaskNode[];
}
