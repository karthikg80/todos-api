import { z } from "zod";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HTML_TAG_PATTERN = /<[^>]*>/g;

export const planSubtaskSuggestionSchema = z.object({
  tempId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(140),
}).strict();

export const planTaskSuggestionSchema = z.object({
  tempId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  projectName: z.string().trim().max(50).nullable().optional(),
  dueDate: z.string().regex(ISO_DATE_PATTERN).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]),
  subtasks: z.array(planSubtaskSuggestionSchema).max(20).default([]),
}).strict();

export const planSuggestionV1Schema = z.object({
  schemaVersion: z.literal(1),
  type: z.literal("plan_from_goal"),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  questions: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  tasks: z.array(planTaskSuggestionSchema).min(1).max(20),
}).strict();

export type PlanSuggestionV1 = z.infer<typeof planSuggestionV1Schema>;

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }
  const stripped = value.replace(HTML_TAG_PATTERN, " ");
  const normalized = stripped.replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  const cleaned = cleanText(value, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeTempId(prefix: string, input: unknown, index: number): string {
  const cleaned = cleanText(input, 100);
  return cleaned || `${prefix}-${index + 1}`;
}

function normalizeDueDate(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return ISO_DATE_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizePriority(value: unknown): "low" | "medium" | "high" {
  const normalized = cleanText(value, 10).toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return "medium";
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .slice(0, 10)
    .map((item) => cleanText(item, 300))
    .filter((item) => item.length > 0);
}

export function normalizePlanSuggestionV1(value: unknown): PlanSuggestionV1 {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];

  const tasks = rawTasks
    .slice(0, 20)
    .map((task, index) => {
      if (!task || typeof task !== "object") {
        return null;
      }
      const item = task as Record<string, unknown>;
      const title = cleanText(item.title, 140);
      if (!title) {
        return null;
      }

      const rawSubtasks = Array.isArray(item.subtasks) ? item.subtasks : [];
      const subtasks = rawSubtasks
        .slice(0, 20)
        .map((subtask, subtaskIndex) => {
          if (!subtask || typeof subtask !== "object") {
            return null;
          }
          const subtaskItem = subtask as Record<string, unknown>;
          const subtaskTitle = cleanText(subtaskItem.title, 140);
          if (!subtaskTitle) {
            return null;
          }

          return {
            tempId: normalizeTempId("subtask", subtaskItem.tempId, subtaskIndex),
            title: subtaskTitle,
          };
        })
        .filter((item): item is NonNullable<typeof item> => !!item);

      return {
        tempId: normalizeTempId("task", item.tempId, index),
        title,
        description: normalizeNullableText(item.description, 1000),
        notes: normalizeNullableText(item.notes, 2000),
        category: normalizeNullableText(item.category, 50),
        projectName: normalizeNullableText(item.projectName, 50),
        dueDate: normalizeDueDate(item.dueDate),
        priority: normalizePriority(item.priority),
        subtasks,
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item);

  return planSuggestionV1Schema.parse({
    schemaVersion: 1,
    type: "plan_from_goal",
    confidence:
      raw.confidence === "low" || raw.confidence === "medium" || raw.confidence === "high"
        ? raw.confidence
        : "medium",
    assumptions: normalizeStringList(raw.assumptions),
    questions: normalizeStringList(raw.questions),
    tasks:
      tasks.length > 0
        ? tasks
        : [
            {
              tempId: "task-1",
              title: "Define execution scope",
              description: null,
              notes: null,
              category: null,
              projectName: null,
              dueDate: null,
              priority: "medium",
              subtasks: [],
            },
          ],
  });
}

export function validatePlanSuggestionV1(value: unknown): PlanSuggestionV1 {
  return planSuggestionV1Schema.parse(value);
}
