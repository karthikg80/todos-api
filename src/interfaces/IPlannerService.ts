import type {
  AnalyzeProjectHealthInput,
  AnalyzeProjectHealthResult,
  AnalyzeWorkGraphInput,
  AnalyzeWorkGraphResult,
  DecideNextWorkInput,
  DecideNextWorkResult,
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
  decideNextWork(input: DecideNextWorkInput): Promise<DecideNextWorkResult>;
  analyzeProjectHealth(
    input: AnalyzeProjectHealthInput,
  ): Promise<AnalyzeProjectHealthResult | null>;
  analyzeWorkGraph(
    input: AnalyzeWorkGraphInput,
  ): Promise<AnalyzeWorkGraphResult | null>;
}
