import { Priority } from "./types";
import { config } from "./config";
import {
  normalizePlanSuggestionV1,
  PlanSuggestionV1,
  validatePlanSuggestionV1,
} from "./ai/planSuggestionSchema";
import { createDefaultLlmClient, LlmClient } from "./ai/llmClient";

export interface CritiqueTaskInput {
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: Priority;
}

export interface CritiqueTaskOutput {
  qualityScore: number;
  improvedTitle: string;
  improvedDescription?: string;
  suggestions: string[];
}

export interface PlanFromGoalInput {
  goal: string;
}

export interface PlanTaskSuggestion {
  title: string;
  description: string;
  priority: Priority;
  dueDate?: Date;
}

export interface PlanFromGoalOutput {
  goal: string;
  summary: string;
  tasks: PlanTaskSuggestion[];
}

export interface StructuredPlanFromGoalOutput {
  draft: PlanSuggestionV1;
  provider?: string;
  model?: string;
}

export interface BreakdownTodoInput {
  title: string;
  description?: string;
  notes?: string;
  priority?: Priority;
  maxSubtasks: number;
}

export interface BreakdownSubtaskSuggestion {
  title: string;
}

export interface BreakdownTodoOutput {
  summary: string;
  subtasks: BreakdownSubtaskSuggestion[];
}

export interface AiGenerationContext {
  rejectionSignals?: string[];
  acceptanceSignals?: string[];
}

interface AiProvider {
  generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T>;
}

const ACTION_VERBS = new Set([
  "define",
  "draft",
  "review",
  "build",
  "write",
  "design",
  "prepare",
  "schedule",
  "ship",
  "publish",
  "launch",
  "test",
  "fix",
  "plan",
  "create",
  "update",
  "complete",
]);

function startsWithActionVerb(title: string): boolean {
  const firstWord = title.trim().split(/\s+/)[0]?.toLowerCase();
  return !!firstWord && ACTION_VERBS.has(firstWord);
}

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function daysUntil(date: Date): number {
  const now = Date.now();
  const diff = date.getTime() - now;
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function critiqueTaskDeterministic(
  input: CritiqueTaskInput,
  context?: AiGenerationContext,
): CritiqueTaskOutput {
  const suggestions: string[] = [];
  let score = 100;
  let improvedTitle = input.title.trim();
  let improvedDescription = input.description?.trim();
  const rejectionSignals = (context?.rejectionSignals || []).map((signal) =>
    signal.toLowerCase(),
  );
  const needsSpecificity = rejectionSignals.some(
    (signal) =>
      signal.includes("generic") ||
      signal.includes("vague") ||
      signal.includes("specific"),
  );

  if (improvedTitle.length < 12) {
    score -= 15;
    suggestions.push(
      "Make the title more specific so it is understandable out of context",
    );
  }

  if (!startsWithActionVerb(improvedTitle)) {
    score -= 10;
    suggestions.push("Start the title with a clear action verb");
    improvedTitle = `Complete ${improvedTitle}`;
  }

  if (!improvedDescription) {
    score -= 20;
    suggestions.push(
      "Add acceptance criteria in the description to define done status",
    );
    improvedDescription =
      "Definition of done: clear output produced, reviewed, and shared with stakeholders.";
  } else if (improvedDescription.length < 30) {
    score -= 10;
    suggestions.push("Expand the description with success criteria");
  }

  if (!input.dueDate) {
    score -= 15;
    suggestions.push("Set a due date to improve execution priority");
  } else {
    const remainingDays = daysUntil(input.dueDate);
    if (remainingDays <= 1 && input.priority !== "high") {
      score -= 10;
      suggestions.push(
        "Task is due soon, consider raising priority to high or splitting scope",
      );
    }
  }

  if (!input.priority || input.priority === "medium") {
    score -= 5;
    suggestions.push(
      "Assign explicit priority (high/medium/low) based on business impact",
    );
  }

  if (needsSpecificity) {
    suggestions.unshift(
      "Make outcomes concrete: include owner, measurable result, and deadline",
    );
    improvedDescription = improvedDescription
      ? `${improvedDescription} Include owner, measurable result, and deadline.`
      : "Definition of done: include owner, measurable result, and deadline.";
  }

  return {
    qualityScore: cap(score, 0, 100),
    improvedTitle,
    improvedDescription,
    suggestions,
  };
}

function distributeDueDates(
  startDate: Date,
  targetDate: Date,
  count: number,
): Array<Date | undefined> {
  if (count <= 0) return [];
  const msGap = targetDate.getTime() - startDate.getTime();
  if (msGap <= 0) return Array.from({ length: count }, () => undefined);
  const step = msGap / count;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startDate.getTime() + step * (index + 1));
    return date;
  });
}

function buildTaskTemplate(
  goal: string,
): Omit<PlanTaskSuggestion, "dueDate">[] {
  return [
    {
      title: `Define scope for: ${goal}`,
      description:
        "Clarify success criteria, constraints, and stakeholders for this goal.",
      priority: "high",
    },
    {
      title: `Break down execution plan for: ${goal}`,
      description:
        "Create milestones with measurable checkpoints and clear ownership.",
      priority: "high",
    },
    {
      title: `Execute core work for: ${goal}`,
      description:
        "Deliver the highest-impact implementation tasks first to reduce risk.",
      priority: "high",
    },
    {
      title: `Review and QA for: ${goal}`,
      description:
        "Validate quality, test edge cases, and confirm readiness for release.",
      priority: "medium",
    },
    {
      title: `Publish update and retrospective for: ${goal}`,
      description:
        "Communicate outcomes, capture lessons learned, and document next steps.",
      priority: "medium",
    },
  ];
}

export function planFromGoalDeterministic(
  input: PlanFromGoalInput,
  context?: AiGenerationContext,
): PlanFromGoalOutput {
  const rejectionSignals = (context?.rejectionSignals || []).map((signal) =>
    signal.toLowerCase(),
  );
  const needsSpecificity = rejectionSignals.some(
    (signal) =>
      signal.includes("generic") ||
      signal.includes("vague") ||
      signal.includes("specific"),
  );
  const maxTasks = 5;
  const baseTasks = buildTaskTemplate(input.goal).slice(0, maxTasks);
  const dueDates = Array.from({ length: baseTasks.length }, () => undefined);

  const tasks = baseTasks.map((task, index) => ({
    ...task,
    description: needsSpecificity
      ? `${task.description} Assign owner, metric, and date for this step.`
      : task.description,
    dueDate: dueDates[index],
  }));

  return {
    goal: input.goal,
    summary: needsSpecificity
      ? `Execution plan with ${tasks.length} specific steps generated for "${input.goal}".`
      : `Execution plan with ${tasks.length} steps generated for "${input.goal}".`,
    tasks,
  };
}

function truncateTaskTitle(value: string, maxLength = 180): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function breakdownTodoDeterministic(
  input: BreakdownTodoInput,
  context?: AiGenerationContext,
): BreakdownTodoOutput {
  const rejectionSignals = (context?.rejectionSignals || []).map((signal) =>
    signal.toLowerCase(),
  );
  const needsSpecificity = rejectionSignals.some(
    (signal) =>
      signal.includes("generic") ||
      signal.includes("vague") ||
      signal.includes("specific"),
  );

  const base = [
    `Define done criteria for: ${input.title}`,
    `Collect inputs and dependencies for: ${input.title}`,
    `Execute core work for: ${input.title}`,
    `Review quality and edge cases for: ${input.title}`,
    `Close out and communicate status for: ${input.title}`,
  ];

  const subtasks = base.slice(0, input.maxSubtasks).map((title) => ({
    title: needsSpecificity
      ? truncateTaskTitle(`${title} (owner + metric + due date)`)
      : truncateTaskTitle(title),
  }));

  return {
    summary: `Generated ${subtasks.length} implementation subtasks.`,
    subtasks,
  };
}

class OpenAiCompatibleProvider implements AiProvider {
  async generateJson<T>(systemPrompt: string, userPrompt: string): Promise<T> {
    const response = await fetch(
      `${config.aiProviderBaseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.aiProviderApiKey}`,
        },
        body: JSON.stringify({
          model: config.aiProviderModel,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `AI provider request failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI provider returned empty content");
    }

    return JSON.parse(content) as T;
  }
}

function parseCritiqueOutput(value: unknown): CritiqueTaskOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.qualityScore !== "number" ||
    typeof v.improvedTitle !== "string" ||
    !Array.isArray(v.suggestions)
  ) {
    return null;
  }

  return {
    qualityScore: cap(v.qualityScore, 0, 100),
    improvedTitle: v.improvedTitle,
    improvedDescription:
      typeof v.improvedDescription === "string"
        ? v.improvedDescription
        : undefined,
    suggestions: v.suggestions
      .filter((item): item is string => typeof item === "string")
      .slice(0, 8),
  };
}

function parsePlanOutput(value: unknown): PlanFromGoalOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.goal !== "string" ||
    typeof v.summary !== "string" ||
    !Array.isArray(v.tasks)
  ) {
    return null;
  }

  const tasks: PlanTaskSuggestion[] = [];
  for (const task of v.tasks) {
    if (!task || typeof task !== "object") {
      continue;
    }
    const t = task as Record<string, unknown>;
    if (
      typeof t.title !== "string" ||
      typeof t.description !== "string" ||
      (t.priority !== "low" && t.priority !== "medium" && t.priority !== "high")
    ) {
      continue;
    }

    const dueDate =
      typeof t.dueDate === "string" && !Number.isNaN(Date.parse(t.dueDate))
        ? new Date(t.dueDate)
        : undefined;

    tasks.push({
      title: t.title,
      description: t.description,
      priority: t.priority as Priority,
      dueDate,
    });
  }

  if (tasks.length === 0) return null;

  return {
    goal: v.goal,
    summary: v.summary,
    tasks,
  };
}

function parseBreakdownOutput(value: unknown): BreakdownTodoOutput | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.subtasks)) {
    return null;
  }

  const subtasks: BreakdownSubtaskSuggestion[] = [];
  for (const subtask of v.subtasks) {
    if (!subtask || typeof subtask !== "object") {
      continue;
    }
    const s = subtask as Record<string, unknown>;
    if (typeof s.title !== "string") {
      continue;
    }
    const title = truncateTaskTitle(s.title);
    if (!title) {
      continue;
    }
    subtasks.push({ title });
  }

  if (subtasks.length === 0) {
    return null;
  }

  return {
    summary:
      typeof v.summary === "string" && v.summary.trim().length > 0
        ? v.summary
        : `Generated ${subtasks.length} implementation subtasks.`,
    subtasks,
  };
}

export class AiPlannerService {
  private readonly provider?: AiProvider;
  private readonly llmClient?: LlmClient;

  constructor(llmClient?: LlmClient) {
    if (config.aiProviderEnabled) {
      this.provider = new OpenAiCompatibleProvider();
    }
    this.llmClient = llmClient || createDefaultLlmClient();
  }

  private deterministicPlanSuggestion(
    goal: string,
    context?: AiGenerationContext,
  ): PlanSuggestionV1 {
    const fallback = planFromGoalDeterministic({ goal }, context);
    return normalizePlanSuggestionV1({
      schemaVersion: 1,
      type: "plan_from_goal",
      confidence: "medium",
      assumptions: [
        "Task order assumes dependencies can be handled in sequence.",
      ],
      questions: [
        "Are there deadlines or dependencies that should reprioritize tasks?",
      ],
      tasks: fallback.tasks.map((task, index) => ({
        tempId: `task-${index + 1}`,
        title: task.title,
        description: task.description || null,
        notes: null,
        category: "AI Plan",
        projectName: null,
        dueDate: task.dueDate
          ? task.dueDate.toISOString().slice(0, 10)
          : null,
        priority: task.priority,
        subtasks: [],
      })),
    });
  }

  async generatePlanFromGoalDraft(
    input: PlanFromGoalInput,
    context?: AiGenerationContext | Record<string, unknown>,
  ): Promise<StructuredPlanFromGoalOutput> {
    const deterministic = this.deterministicPlanSuggestion(
      input.goal,
      context as AiGenerationContext | undefined,
    );
    if (!this.llmClient) {
      return { draft: deterministic };
    }

    try {
      const contextRecord: Record<string, unknown> =
        context && typeof context === "object"
          ? (context as Record<string, unknown>)
          : {};
      const generated = await this.llmClient.generateStructuredPlan(
        input.goal,
        contextRecord,
      );
      const parsed = validatePlanSuggestionV1(generated.payload);
      return {
        draft: normalizePlanSuggestionV1(parsed),
        provider: generated.provider,
        model: generated.model,
      };
    } catch (error) {
      console.warn(
        "AI provider plan failed or returned invalid schema, using deterministic fallback",
        error,
      );
      return { draft: deterministic };
    }
  }

  async critiqueTask(
    input: CritiqueTaskInput,
    context?: AiGenerationContext,
  ): Promise<CritiqueTaskOutput> {
    const fallback = critiqueTaskDeterministic(input, context);
    if (!this.provider) {
      return fallback;
    }

    try {
      const contextBlock =
        context &&
        (context.rejectionSignals?.length || context.acceptanceSignals?.length)
          ? {
              rejectionSignals: context.rejectionSignals || [],
              acceptanceSignals: context.acceptanceSignals || [],
            }
          : undefined;
      const response = await this.provider.generateJson<unknown>(
        "You are an execution coach. Return JSON with: qualityScore (0-100), improvedTitle, improvedDescription, suggestions (string[]). Keep suggestions actionable and concrete with owners, measurable outcomes, and deadlines where possible.",
        JSON.stringify({
          title: input.title,
          description: input.description || "",
          dueDate: input.dueDate?.toISOString(),
          priority: input.priority || "medium",
          context: contextBlock,
        }),
      );
      return parseCritiqueOutput(response) || fallback;
    } catch (error) {
      console.warn(
        "AI provider critique failed, using deterministic fallback",
        error,
      );
      return fallback;
    }
  }

  async planFromGoal(
    input: PlanFromGoalInput,
    context?: AiGenerationContext,
  ): Promise<PlanFromGoalOutput> {
    const structured = await this.generatePlanFromGoalDraft(input, context);
    return {
      goal: input.goal,
      summary: `Execution plan with ${structured.draft.tasks.length} steps generated for "${input.goal}".`,
      tasks: structured.draft.tasks.map((task) => ({
        title: task.title,
        description: task.description || "",
        priority: task.priority,
        dueDate: task.dueDate
          ? new Date(`${task.dueDate}T00:00:00.000Z`)
          : undefined,
      })),
    };
  }

  async breakdownTodoIntoSubtasks(
    input: BreakdownTodoInput,
    context?: AiGenerationContext,
  ): Promise<BreakdownTodoOutput> {
    const fallback = breakdownTodoDeterministic(input, context);
    if (!this.provider) {
      return fallback;
    }

    try {
      const contextBlock =
        context &&
        (context.rejectionSignals?.length || context.acceptanceSignals?.length)
          ? {
              rejectionSignals: context.rejectionSignals || [],
              acceptanceSignals: context.acceptanceSignals || [],
            }
          : undefined;
      const response = await this.provider.generateJson<unknown>(
        "You decompose a task into execution subtasks. Return JSON with: summary, subtasks[{title}]. Titles must be concise and action-oriented.",
        JSON.stringify({
          title: input.title,
          description: input.description || "",
          notes: input.notes || "",
          priority: input.priority || "medium",
          maxSubtasks: input.maxSubtasks,
          context: contextBlock,
        }),
      );
      const parsed = parseBreakdownOutput(response);
      if (!parsed) {
        return fallback;
      }
      return {
        ...parsed,
        subtasks: parsed.subtasks.slice(0, input.maxSubtasks),
      };
    } catch (error) {
      console.warn(
        "AI provider breakdown failed, using deterministic fallback",
        error,
      );
      return fallback;
    }
  }
}
