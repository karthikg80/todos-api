/**
 * Pure plan-scoring helpers extracted from AgentExecutor.
 *
 * These functions have no side effects and no dependency on executor state —
 * they operate only on their arguments. Extracted so that planningActions.ts
 * can import them directly without coupling to AgentExecutor.
 */

import type { Todo } from "../../../types";
import type { ModeModifiers } from "../../../services/dayContextService";

export interface PlanWeights {
  plannerWeightPriority?: number;
  plannerWeightDueDate?: number;
  plannerWeightEnergyMatch?: number;
  plannerWeightEstimateFit?: number;
  plannerWeightFreshness?: number;
}

export interface PlanInsightBoosts {
  streakBoost: number;
  staleBoost: number;
}

export interface PlanSoulModifiers {
  statusBoosts?: Record<string, number>;
  priorityBoosts?: Record<string, number>;
  effortBoosts?: { maxEffort: number; boost: number };
  budgetMultiplier?: number;
  maxTaskCount?: number;
}

export interface ScoredTask {
  task: Todo;
  score: number;
  effort: number;
  scoreBreakdown: Record<string, number>;
  whyIncluded: string;
}

export interface ExcludedTask {
  task: Todo;
  score: number;
  effort: number;
  whyExcluded: string;
}

export interface PlanScoreResult {
  selected: ScoredTask[];
  excluded: ExcludedTask[];
  usedMinutes: number;
  budgetBreakdown: {
    totalBudget: number;
    scheduled: number;
    remaining: number;
    taskCount: number;
  };
}

export function buildInclusionReason(
  breakdown: Record<string, number>,
  effort: number,
  priority?: string | null,
): string {
  const parts: string[] = [];
  if (priority === "urgent") parts.push("urgent priority");
  else if (priority === "high") parts.push("high priority");
  if (breakdown.doDateBoost === 50) parts.push("scheduled date is overdue");
  else if (breakdown.doDateBoost === 30) parts.push("scheduled for today");
  if (breakdown.dueDateBoost === 40) parts.push("due date is overdue");
  else if (breakdown.dueDateBoost === 20) parts.push("due today");
  if (effort <= 15) parts.push(`quick win (${effort} min)`);
  else if (effort <= 30) parts.push(`fits ${effort}-min slot`);
  if (parts.length === 0) parts.push("ranked within time budget");
  return parts.join(", ");
}

export function scorePlan(
  allTasks: Todo[],
  forDate: string,
  budgetMin: number,
  energy?: string,
  modeModifiers?: ModeModifiers,
  weights?: PlanWeights,
  feedbackAdjustments?: Map<string, number>,
  goalIndex?: Map<string, { targetDate: Date | null }>,
  projectGoalMap?: Map<string, string>,
  insightBoosts?: PlanInsightBoosts,
  soulModifiers?: PlanSoulModifiers,
): PlanScoreResult {
  const PRIORITY_SCORE: Record<string, number> = {
    urgent: 40,
    high: 20,
    medium: 10,
    low: 0,
  };

  const wPriority = weights?.plannerWeightPriority ?? 1.0;
  const wDueDate = weights?.plannerWeightDueDate ?? 1.0;
  const wEnergyMatch = weights?.plannerWeightEnergyMatch ?? 1.0;
  const wEstimateFit = weights?.plannerWeightEstimateFit ?? 1.0;
  const wFreshness = weights?.plannerWeightFreshness ?? 1.0;

  const scored = allTasks.map((t) => {
    const breakdown: Record<string, number> = {};
    const rawPriority = PRIORITY_SCORE[t.priority ?? "medium"] ?? 10;
    const weightedPriority = Math.round(rawPriority * wPriority);
    let score = weightedPriority;
    breakdown.priority = weightedPriority;

    if (t.doDate) {
      const d =
        t.doDate instanceof Date
          ? t.doDate.toISOString().slice(0, 10)
          : String(t.doDate).slice(0, 10);
      if (d < forDate) {
        score += 50;
        breakdown.doDateBoost = 50;
      } else if (d === forDate) {
        score += 30;
        breakdown.doDateBoost = 30;
      }
    }
    if (t.dueDate) {
      const d =
        t.dueDate instanceof Date
          ? t.dueDate.toISOString().slice(0, 10)
          : String(t.dueDate).slice(0, 10);
      const rawDueDateBoost = d < forDate ? 40 : d === forDate ? 20 : 0;
      if (rawDueDateBoost > 0) {
        const weightedDueDateBoost = Math.round(rawDueDateBoost * wDueDate);
        score += weightedDueDateBoost;
        breakdown.dueDateBoost = weightedDueDateBoost;
      }
    }
    const effort = t.effortScore ?? 30;
    if (energy === "low" && effort > 60) {
      const penalty = Math.round(20 * wEnergyMatch);
      score -= penalty;
      breakdown.energyPenalty = -penalty;
    }
    if (energy === "high" && effort < 15) {
      const penalty = Math.round(5 * wEnergyMatch);
      score -= penalty;
      breakdown.energyPenalty = -penalty;
    }

    // Mode-based boosts (#336)
    if (modeModifiers) {
      const { scoreBoosts } = modeModifiers;
      if (scoreBoosts.shortTask && effort <= 20) {
        score += scoreBoosts.shortTask;
        breakdown.modeBoost =
          (breakdown.modeBoost ?? 0) + scoreBoosts.shortTask;
      }
      if (scoreBoosts.adminTask && !t.projectId) {
        score += scoreBoosts.adminTask;
        breakdown.modeBoost =
          (breakdown.modeBoost ?? 0) + scoreBoosts.adminTask;
      }
      if (scoreBoosts.projectTask && t.projectId) {
        score += scoreBoosts.projectTask;
        breakdown.modeBoost =
          (breakdown.modeBoost ?? 0) + scoreBoosts.projectTask;
      }
      if (scoreBoosts.waitingTask && t.status === "waiting") {
        score += scoreBoosts.waitingTask;
        breakdown.modeBoost =
          (breakdown.modeBoost ?? 0) + scoreBoosts.waitingTask;
      }
    }

    // Feedback adjustment from accepted/ignored history
    const fbAdj = feedbackAdjustments?.get(t.id) ?? 0;
    if (fbAdj !== 0) {
      score += fbAdj;
      breakdown.feedbackAdjustment = fbAdj;
    }

    // Goal alignment boost
    const taskGoalId =
      (t as any).goalId ||
      (t.projectId ? projectGoalMap?.get(t.projectId) : undefined);
    if (taskGoalId && goalIndex?.has(taskGoalId)) {
      const goal = goalIndex.get(taskGoalId)!;
      const directGoal = !!(t as any).goalId;
      const baseBoost = directGoal ? 12 : 9;
      score += baseBoost;
      breakdown.goalAlignment = baseBoost;
      if (goal.targetDate) {
        const daysToGoal =
          (goal.targetDate.getTime() - Date.now()) / 86_400_000;
        if (daysToGoal >= 0 && daysToGoal <= 14) {
          const urgencyBoost = directGoal ? 8 : 6;
          score += urgencyBoost;
          breakdown.goalAlignment += urgencyBoost;
        }
      }
    }

    // Insight-driven boosts (streak momentum, stale nudge)
    if (insightBoosts) {
      if (insightBoosts.streakBoost && t.status === "in_progress") {
        score += insightBoosts.streakBoost;
        breakdown.insightBoost =
          (breakdown.insightBoost ?? 0) + insightBoosts.streakBoost;
      }
      if (insightBoosts.staleBoost && t.updatedAt) {
        const updMs =
          t.updatedAt instanceof Date
            ? t.updatedAt.getTime()
            : new Date(String(t.updatedAt)).getTime();
        if ((Date.now() - updMs) / 86_400_000 > 7) {
          score += insightBoosts.staleBoost;
          breakdown.insightBoost =
            (breakdown.insightBoost ?? 0) + insightBoosts.staleBoost;
        }
      }
    }

    // Soul profile modifiers
    if (soulModifiers) {
      const statusKey = t.status ?? "";
      if (soulModifiers.statusBoosts?.[statusKey]) {
        const boost = soulModifiers.statusBoosts[statusKey];
        score += boost;
        breakdown.soulBoost = (breakdown.soulBoost ?? 0) + boost;
      }
      const prioKey = t.priority ?? "medium";
      if (soulModifiers.priorityBoosts?.[prioKey]) {
        const boost = soulModifiers.priorityBoosts[prioKey];
        score += boost;
        breakdown.soulBoost = (breakdown.soulBoost ?? 0) + boost;
      }
      if (
        soulModifiers.effortBoosts &&
        effort <= soulModifiers.effortBoosts.maxEffort
      ) {
        score += soulModifiers.effortBoosts.boost;
        breakdown.soulBoost =
          (breakdown.soulBoost ?? 0) + soulModifiers.effortBoosts.boost;
      }
    }

    // Estimate fit: score against total budget proportions
    if (budgetMin > 0) {
      if (effort <= budgetMin * 0.25) {
        const boost = Math.round(8 * wEstimateFit);
        score += boost;
        breakdown.estimateFit = boost;
      } else if (effort > budgetMin * 0.6) {
        const penalty = Math.round(12 * wEstimateFit);
        score -= penalty;
        breakdown.estimateFit = -penalty;
      }
    }

    // Freshness: recently touched tasks get a boost, stale ones get penalized
    if (t.updatedAt) {
      const updatedMs =
        t.updatedAt instanceof Date
          ? t.updatedAt.getTime()
          : new Date(String(t.updatedAt)).getTime();
      const daysSinceUpdate = (Date.now() - updatedMs) / 86_400_000;
      if (daysSinceUpdate < 2) {
        const boost = Math.round(10 * wFreshness);
        score += boost;
        breakdown.freshness = boost;
      } else if (daysSinceUpdate > 14) {
        const penalty = Math.round(10 * wFreshness);
        score -= penalty;
        breakdown.freshness = -penalty;
      }
    }

    return { task: t, score, effort, scoreBreakdown: breakdown };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: (typeof scored)[number][] = [];
  const excludedBudget: (typeof scored)[number][] = [];
  let usedMinutes = 0;

  for (const item of scored) {
    if (usedMinutes + item.effort <= budgetMin) {
      selected.push(item);
      usedMinutes += item.effort;
    } else {
      excludedBudget.push(item);
    }
  }

  const selectedIds = new Set(selected.map((s) => s.task.id));

  return {
    selected: selected.map((s) => ({
      ...s,
      whyIncluded: buildInclusionReason(
        s.scoreBreakdown,
        s.effort,
        s.task.priority,
      ),
    })),
    excluded: excludedBudget.slice(0, 5).map((s) => ({
      task: s.task,
      score: s.score,
      effort: s.effort,
      whyExcluded: selectedIds.has(s.task.id)
        ? "low_score"
        : energy && s.scoreBreakdown.energyPenalty !== undefined
          ? "energy_mismatch"
          : "budget_exceeded",
    })),
    usedMinutes,
    budgetBreakdown: {
      totalBudget: budgetMin,
      scheduled: usedMinutes,
      remaining: budgetMin - usedMinutes,
      taskCount: selected.length,
    },
  };
}
