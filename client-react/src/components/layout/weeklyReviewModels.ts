export interface ReviewSummary {
  projectsWithoutNextAction: number;
  staleTasks: number;
  waitingTasks: number;
  upcomingTasks: number;
}

export interface Finding {
  type: string;
  taskTitle: string;
  reason: string;
}

export interface ReviewAction {
  type: string;
  title: string;
  reason: string;
}

export interface ReviewData {
  summary: ReviewSummary | null;
  findings: Finding[];
  actions: ReviewAction[];
  rolloverGroups: Array<{ label: string; tasks: Array<{ title: string }> }>;
  anchorSuggestions: Array<{ title: string; reason: string }>;
  behaviorAdjustment: string;
  reflectionSummary: string;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function unwrapReviewPayload(payload: unknown): Record<string, unknown> {
  const root = asObject(payload);
  const data = asObject(root?.data);
  return asObject(data?.review) ?? data ?? root ?? {};
}

export function normalizeWeeklyReviewResponse(payload: unknown): ReviewData {
  const review = unwrapReviewPayload(payload);
  const summary = asObject(review.summary);
  const recommendedActions = asArray(review.recommendedActions);
  const appliedActions = asArray(review.appliedActions);
  const legacyActions = asArray(review.actions);
  const rawActions =
    recommendedActions.length > 0
      ? recommendedActions
      : appliedActions.length > 0
        ? appliedActions
        : legacyActions;

  return {
    summary: summary
      ? {
          projectsWithoutNextAction:
            typeof summary.projectsWithoutNextAction === "number"
              ? summary.projectsWithoutNextAction
              : 0,
          staleTasks:
            typeof summary.staleTasks === "number" ? summary.staleTasks : 0,
          waitingTasks:
            typeof summary.waitingTasks === "number" ? summary.waitingTasks : 0,
          upcomingTasks:
            typeof summary.upcomingTasks === "number"
              ? summary.upcomingTasks
              : 0,
        }
      : null,
    findings: asArray(review.findings).map((item) => {
      const finding = asObject(item);
      return {
        type: asString(finding?.type),
        taskTitle:
          asString(finding?.taskTitle) ||
          asString(finding?.projectName) ||
          asString(finding?.title),
        reason: asString(finding?.reason),
      };
    }),
    actions: rawActions.map((item) => {
      const action = asObject(item);
      return {
        type: asString(action?.type),
        title: asString(action?.title),
        reason: asString(action?.reason),
      };
    }),
    rolloverGroups: asArray(review.rolloverGroups).map((item) => {
      const group = asObject(item);
      const rawTasks = asArray(group?.tasks).length
        ? asArray(group?.tasks)
        : asArray(group?.items);
      return {
        label: asString(group?.label) || asString(group?.key) || "Group",
        tasks: rawTasks.map((task) => {
          const row = asObject(task);
          return { title: asString(row?.title) || "Untitled task" };
        }),
      };
    }),
    anchorSuggestions: asArray(review.anchorSuggestions).map((item) => {
      const anchor = asObject(item);
      return {
        title: asString(anchor?.title),
        reason: asString(anchor?.reason),
      };
    }),
    behaviorAdjustment: asString(review.behaviorAdjustment),
    reflectionSummary: asString(review.reflectionSummary),
  };
}
