export type Priority = "low" | "medium" | "high" | "urgent";
export type McpScope =
  | "tasks.read"
  | "tasks.write"
  | "projects.read"
  | "projects.write";
export type TaskStatus =
  | "inbox"
  | "next"
  | "in_progress"
  | "waiting"
  | "scheduled"
  | "someday"
  | "done"
  | "cancelled";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type Energy = "low" | "medium" | "high";
export type ReviewCadence = "weekly" | "biweekly" | "monthly" | "quarterly";
export type TaskSource =
  | "manual"
  | "chat"
  | "email"
  | "import"
  | "automation"
  | "api";
export type RecurrenceType =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "rrule";
export type TodoSortBy =
  | "order"
  | "createdAt"
  | "updatedAt"
  | "dueDate"
  | "priority"
  | "title";
export type SortOrder = "asc" | "desc";

export interface TodoRecurrence {
  type: RecurrenceType;
  interval?: number | null;
  rrule?: string | null;
  nextOccurrence?: Date | null;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  order: number;
  completedAt?: Date | null;
  todoId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority?: Priority | null;
  area?: string | null;
  goal?: string | null;
  targetDate?: Date | null;
  reviewCadence?: ReviewCadence | null;
  lastReviewedAt?: Date | null;
  archived: boolean;
  archivedAt?: Date | null;
  areaId?: string | null;
  goalId?: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  taskCount?: number;
  openTaskCount?: number;
  completedTaskCount?: number;
  todoCount?: number;
  openTodoCount?: number;
}

export interface Heading {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  completed: boolean;
  projectId?: string | null;
  category?: string;
  tags: string[];
  context?: string | null;
  energy?: Energy | null;
  headingId?: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  scheduledDate?: Date | null;
  reviewDate?: Date | null;
  completedAt?: Date | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds: string[];
  order: number;
  priority?: Priority | null;
  archived: boolean;
  recurrence: TodoRecurrence;
  source?: TaskSource | null;
  doDate?: Date | null;
  blockedReason?: string | null;
  effortScore?: number | null;
  confidenceScore?: number | null;
  sourceText?: string | null;
  areaId?: string | null;
  goalId?: string | null;
  createdByPrompt?: string | null;
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  subtasks?: Subtask[];
}

export interface CreateProjectDto {
  name: string;
  description?: string | null;
  status?: ProjectStatus | null;
  priority?: Priority | null;
  area?: string | null;
  goal?: string | null;
  targetDate?: Date | null;
  reviewCadence?: ReviewCadence | null;
  lastReviewedAt?: Date | null;
  archived?: boolean;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  status?: ProjectStatus | null;
  priority?: Priority | null;
  area?: string | null;
  goal?: string | null;
  targetDate?: Date | null;
  reviewCadence?: ReviewCadence | null;
  lastReviewedAt?: Date | null;
  archived?: boolean;
}

export type ProjectTaskDisposition = "unsorted" | "delete";

export interface CreateHeadingDto {
  name: string;
}

export interface CreateTodoDto {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  headingId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  scheduledDate?: Date | null;
  reviewDate?: Date | null;
  priority?: Priority | null;
  tags?: string[];
  context?: string | null;
  energy?: Energy | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds?: string[];
  archived?: boolean;
  recurrence?: Partial<TodoRecurrence> | null;
  source?: TaskSource | null;
  doDate?: Date | null;
  blockedReason?: string | null;
  effortScore?: number | null;
  confidenceScore?: number | null;
  sourceText?: string | null;
  areaId?: string | null;
  goalId?: string | null;
  createdByPrompt?: string | null;
  notes?: string | null;
}

export interface UpdateTodoDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completed?: boolean;
  projectId?: string | null;
  category?: string | null;
  headingId?: string | null;
  dueDate?: Date | null;
  startDate?: Date | null;
  scheduledDate?: Date | null;
  reviewDate?: Date | null;
  order?: number;
  priority?: Priority | null;
  tags?: string[];
  context?: string | null;
  energy?: Energy | null;
  estimateMinutes?: number | null;
  waitingOn?: string | null;
  dependsOnTaskIds?: string[];
  archived?: boolean;
  recurrence?: Partial<TodoRecurrence> | null;
  source?: TaskSource | null;
  doDate?: Date | null;
  blockedReason?: string | null;
  effortScore?: number | null;
  confidenceScore?: number | null;
  sourceText?: string | null;
  areaId?: string | null;
  goalId?: string | null;
  createdByPrompt?: string | null;
  notes?: string | null;
}

export interface CreateSubtaskDto {
  title: string;
}

export interface UpdateSubtaskDto {
  title?: string;
  completed?: boolean;
  order?: number;
}

export interface ReorderTodoItemDto {
  id: string;
  order: number;
  headingId?: string | null;
}

export interface ReorderHeadingItemDto {
  id: string;
  sortOrder: number;
}

export interface DryRunPatch {
  operation: "create" | "update" | "delete";
  entityKind: "task" | "project" | "capture" | "area" | "goal";
  entityId?: string;
  fields: Record<string, unknown>;
}

export interface DryRunResult {
  dryRun: true;
  proposedChanges: DryRunPatch[];
}

export interface FindTodosQuery {
  completed?: boolean;
  priority?: Priority;
  statuses?: TaskStatus[];
  category?: string;
  search?: string;
  project?: string;
  projectId?: string;
  unsorted?: boolean;
  archived?: boolean;
  tags?: string[];
  contexts?: string[];
  energies?: Energy[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  dueDateAfter?: Date;
  dueDateBefore?: Date;
  dueDateIsNull?: boolean;
  startDateFrom?: Date;
  startDateTo?: Date;
  scheduledDateFrom?: Date;
  scheduledDateTo?: Date;
  reviewDateFrom?: Date;
  reviewDateTo?: Date;
  updatedBefore?: Date;
  updatedAfter?: Date;
  sortBy?: TodoSortBy;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

export interface AreaDto {
  id: string;
  name: string;
  description?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalDto {
  id: string;
  name: string;
  description?: string | null;
  targetDate?: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaptureItemDto {
  id: string;
  text: string;
  source?: string | null;
  capturedAt: string;
  lifecycle: "new" | "triaged" | "discarded";
  triageResult?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface UserPlanningPreferencesDto {
  maxDailyTasks?: number | null;
  preferredChunkMinutes?: number | null;
  deepWorkPreference?: string | null;
  weekendsActive: boolean;
  preferredContexts: string[];
  waitingFollowUpDays: number;
  workWindowsJson?: unknown;
}

export interface CreateCaptureItemDto {
  text: string;
  source?: string;
  capturedAt?: string;
}

export type FeedbackRequestType = "bug" | "feature" | "general";
export type FeedbackRequestStatus = "new" | "triaged" | "closed";

export interface FeedbackAttachmentMetadataDto {
  name?: string | null;
  type?: string | null;
  size?: number | null;
  lastModified?: number | null;
}

export interface CreateFeedbackRequestDto {
  type: FeedbackRequestType;
  title: string;
  body: string;
  screenshotUrl?: string | null;
  attachmentMetadata?: FeedbackAttachmentMetadataDto | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
}

export interface FeedbackRequestDto {
  id: string;
  userId: string;
  type: FeedbackRequestType;
  title: string;
  body: string;
  screenshotUrl?: string | null;
  attachmentMetadata?: FeedbackAttachmentMetadataDto | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  status: FeedbackRequestStatus;
  triageSummary?: string | null;
  severity?: string | null;
  dedupeKey?: string | null;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}
