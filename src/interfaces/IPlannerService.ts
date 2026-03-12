import type {
  EnsureNextActionInput,
  EnsureNextActionResult,
  PlanProjectInput,
  PlanProjectResult,
  WeeklyReviewInput,
  WeeklyReviewResult,
} from "../types/plannerTypes";

export type { PlannerMode, PlannerTaskSuggestion } from "../types/plannerTypes";

export interface IPlannerService {
  planProject(input: PlanProjectInput): Promise<PlanProjectResult | null>;
  ensureNextAction(
    input: EnsureNextActionInput,
  ): Promise<EnsureNextActionResult | null>;
  weeklyReview(input: WeeklyReviewInput): Promise<WeeklyReviewResult>;
}
