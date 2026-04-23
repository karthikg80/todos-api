import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });
const nullableIsoDateTimeSchema = isoDateTimeSchema.nullable().optional();

export const todoStatusSchema = z.enum([
  "inbox",
  "next",
  "in_progress",
  "waiting",
  "scheduled",
  "someday",
  "done",
  "cancelled",
]);

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export const recurrenceTypeSchema = z.enum([
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "rrule",
]);

export const todoRecurrenceDtoSchema = z.object({
  type: recurrenceTypeSchema,
  interval: z.number().nullable().optional(),
  rrule: z.string().nullable().optional(),
  nextOccurrence: nullableIsoDateTimeSchema,
});

export const subtaskDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  order: z.number(),
  completedAt: nullableIsoDateTimeSchema,
  todoId: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const headingDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  sortOrder: z.number(),
});

export const soulProfileDtoSchema = z.object({
  lifeAreas: z.array(z.string()),
  failureModes: z.array(z.string()),
  planningStyle: z.enum(["structure", "flexibility", "both"]),
  energyPattern: z.enum(["morning", "afternoon", "evening", "variable"]),
  goodDayThemes: z.array(z.string()),
  tone: z.enum(["calm", "focused", "encouraging", "direct"]),
  dailyRitual: z.enum(["morning_plan", "evening_reset", "both", "neither"]),
});

export const userPlanningPreferencesDtoSchema = z.object({
  maxDailyTasks: z.number().nullable().optional(),
  preferredChunkMinutes: z.number().nullable().optional(),
  deepWorkPreference: z.string().nullable().optional(),
  weekendsActive: z.boolean(),
  preferredContexts: z.array(z.string()),
  waitingFollowUpDays: z.number(),
  workWindowsJson: z.unknown().optional(),
  soulProfile: soulProfileDtoSchema,
});

export const todoDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: todoStatusSchema,
  completed: z.boolean(),
  completedAt: nullableIsoDateTimeSchema,
  projectId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  headingId: z.string().nullable().optional(),
  tags: z.array(z.string()),
  context: z.string().nullable().optional(),
  energy: z.enum(["low", "medium", "high"]).nullable().optional(),
  dueDate: nullableIsoDateTimeSchema,
  startDate: nullableIsoDateTimeSchema,
  scheduledDate: nullableIsoDateTimeSchema,
  reviewDate: nullableIsoDateTimeSchema,
  doDate: nullableIsoDateTimeSchema,
  estimateMinutes: z.number().nullable().optional(),
  waitingOn: z.string().nullable().optional(),
  dependsOnTaskIds: z.array(z.string()),
  order: z.number(),
  priority: prioritySchema.nullable().optional(),
  archived: z.boolean(),
  firstStep: z.string().nullable().optional(),
  emotionalState: z.string().nullable().optional(),
  effortScore: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  recurrence: todoRecurrenceDtoSchema.nullable().optional(),
  subtasks: z.array(subtaskDtoSchema).optional(),
  userId: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const projectDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  status: z.enum(["active", "on_hold", "completed", "archived"]),
  priority: prioritySchema.nullable().optional(),
  area: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  targetDate: nullableIsoDateTimeSchema,
  archived: z.boolean(),
  todoCount: z.number().optional(),
  openTodoCount: z.number().optional(),
  completedTaskCount: z.number().optional(),
  userId: z.string(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable().optional(),
  role: z.string().optional(),
  isVerified: z.boolean().optional(),
  plan: z.string().optional(),
  onboardingStep: z.number().nullable().optional(),
  onboardingCompletedAt: nullableIsoDateTimeSchema,
});

export const mcpSessionSummaryDtoSchema = z.object({
  id: z.string(),
  userId: z.string(),
  scopes: z.array(z.string()),
  source: z.enum(["oauth", "local"]),
  clientId: z.string().optional(),
  assistantName: z.string().optional(),
  revokedAt: z.string().optional(),
  lastAccessTokenIssuedAt: z.string().optional(),
  lastUsedAt: z.string().optional(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const createTodoDtoSchema = z.object({
  title: z.string(),
  description: z.string().nullable().optional(),
  status: todoStatusSchema.optional(),
  completed: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  headingId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  dueDate: nullableIsoDateTimeSchema,
  startDate: nullableIsoDateTimeSchema,
  scheduledDate: nullableIsoDateTimeSchema,
  priority: prioritySchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  energy: z.enum(["low", "medium", "high"]).nullable().optional(),
  context: z.string().nullable().optional(),
  estimateMinutes: z.number().nullable().optional(),
  firstStep: z.string().nullable().optional(),
  emotionalState: z.string().nullable().optional(),
  effortScore: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
});

export const updateTodoDtoSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: todoStatusSchema.optional(),
  completed: z.boolean().optional(),
  projectId: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  dueDate: nullableIsoDateTimeSchema,
  order: z.number().optional(),
  priority: prioritySchema.nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  firstStep: z.string().nullable().optional(),
  energy: z.enum(["low", "medium", "high"]).nullable().optional(),
  estimateMinutes: z.number().nullable().optional(),
  waitingOn: z.string().nullable().optional(),
  context: z.string().nullable().optional(),
  emotionalState: z.string().nullable().optional(),
  recurrence: todoRecurrenceDtoSchema.partial().nullable().optional(),
  archived: z.boolean().optional(),
  scheduledDate: nullableIsoDateTimeSchema,
  startDate: nullableIsoDateTimeSchema,
  headingId: z.string().nullable().optional(),
});

export const updateHeadingDtoSchema = z.object({
  name: z.string().optional(),
});

export type TodoStatus = z.infer<typeof todoStatusSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type RecurrenceType = z.infer<typeof recurrenceTypeSchema>;
export type TodoRecurrenceDto = z.infer<typeof todoRecurrenceDtoSchema>;
export type SubtaskDto = z.infer<typeof subtaskDtoSchema>;
export type HeadingDto = z.infer<typeof headingDtoSchema>;
export type SoulProfileDto = z.infer<typeof soulProfileDtoSchema>;
export type UserPlanningPreferencesDto = z.infer<
  typeof userPlanningPreferencesDtoSchema
>;
export type TodoDto = z.infer<typeof todoDtoSchema>;
export type ProjectDto = z.infer<typeof projectDtoSchema>;
export type UserDto = z.infer<typeof userDtoSchema>;
export type McpSessionSummaryDto = z.infer<typeof mcpSessionSummaryDtoSchema>;
export type CreateTodoDto = z.infer<typeof createTodoDtoSchema>;
export type UpdateTodoDto = z.infer<typeof updateTodoDtoSchema>;
export type UpdateHeadingDto = z.infer<typeof updateHeadingDtoSchema>;
