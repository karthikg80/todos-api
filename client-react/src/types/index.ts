export interface Todo {
  id: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  status: TodoStatus;
  completed: boolean;
  completedAt?: string | null;
  projectId?: string | null;
  category?: string | null;
  headingId?: string | null;
  tags: string[];
  context?: string | null;
  energy?: "low" | "medium" | "high" | null;
  dueDate?: string | null;
  startDate?: string | null;
  scheduledDate?: string | null;
  reviewDate?: string | null;
  doDate?: string | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds: string[];
  order: number;
  priority?: Priority | null;
  archived: boolean;
  firstStep?: string | null;
  emotionalState?: string | null;
  effortScore?: number | null;
  source?: string | null;
  recurrence?: TodoRecurrence | null;
  subtasks?: Subtask[];
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface TodoRecurrence {
  type: RecurrenceType;
  interval?: number | null;
  nextOccurrence?: string | null;
}

export type TodoStatus =
  | "inbox"
  | "next"
  | "in_progress"
  | "waiting"
  | "scheduled"
  | "someday"
  | "done"
  | "cancelled";

export type Priority = "low" | "medium" | "high" | "urgent";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  completedAt?: string | null;
  todoId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: "active" | "on_hold" | "completed" | "archived";
  priority?: Priority | null;
  area?: string | null;
  areaId?: string | null;
  targetDate?: string | null;
  archived: boolean;
  todoCount?: number;
  openTodoCount?: number;
  completedTaskCount?: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Heading {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
}

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  isVerified?: boolean;
  plan?: string;
  onboardingStep?: number | null;
  onboardingCompletedAt?: string | null;
}

export interface SoulProfile {
  lifeAreas: string[];
  failureModes: string[];
  planningStyle: "structure" | "flexibility" | "both";
  energyPattern: "morning" | "afternoon" | "evening" | "variable";
  goodDayThemes: string[];
  tone: "calm" | "focused" | "encouraging" | "direct";
  dailyRitual: "morning_plan" | "evening_reset" | "both" | "neither";
}

export interface UserPlanningPreferences {
  maxDailyTasks?: number | null;
  preferredChunkMinutes?: number | null;
  deepWorkPreference?: string | null;
  weekendsActive: boolean;
  preferredContexts: string[];
  waitingFollowUpDays: number;
  workWindowsJson?: unknown;
  soulProfile: SoulProfile;
}

export interface McpSessionSummary {
  id: string;
  userId: string;
  scopes: string[];
  source: "oauth" | "local";
  clientId?: string;
  assistantName?: string;
  revokedAt?: string;
  lastAccessTokenIssuedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string | null;
  status?: TodoStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  scheduledDate?: string | null;
  priority?: Priority | null;
  tags?: string[];
  energy?: "low" | "medium" | "high" | null;
  context?: string | null;
  estimateMinutes?: number | null;
  firstStep?: string | null;
  emotionalState?: string | null;
  effortScore?: number | null;
  source?: string | null;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string | null;
  status?: TodoStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  dueDate?: string | null;
  priority?: Priority | null;
  tags?: string[];
  notes?: string | null;
  firstStep?: string | null;
  energy?: "low" | "medium" | "high" | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  context?: string | null;
  emotionalState?: string | null;
  recurrence?: Partial<TodoRecurrence> | null;
  archived?: boolean;
  scheduledDate?: string | null;
  startDate?: string | null;
  headingId?: string | null;
}
