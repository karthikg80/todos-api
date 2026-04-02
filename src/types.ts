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
  | "system_seed"
  | "chat"
  | "email"
  | "import"
  | "automation"
  | "api";
export type TodoEmotionalState =
  | "avoiding"
  | "unclear"
  | "heavy"
  | "exciting"
  | "draining";
export type SoulPlanningStyle = "structure" | "flexibility" | "both";
export type SoulEnergyPattern =
  | "morning"
  | "afternoon"
  | "evening"
  | "variable";
export type SoulTone = "calm" | "focused" | "encouraging" | "direct";
export type SoulDailyRitual =
  | "morning_plan"
  | "evening_reset"
  | "both"
  | "neither";
export interface SoulProfileDto {
  lifeAreas: string[];
  failureModes: string[];
  planningStyle: SoulPlanningStyle;
  energyPattern: SoulEnergyPattern;
  goodDayThemes: string[];
  tone: SoulTone;
  dailyRitual: SoulDailyRitual;
}
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
  firstStep?: string | null;
  emotionalState?: TodoEmotionalState | null;
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
  firstStep?: string | null;
  emotionalState?: TodoEmotionalState | null;
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
  firstStep?: string | null;
  emotionalState?: TodoEmotionalState | null;
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
  needsOrganizing?: boolean;
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
  soulProfile?: SoulProfileDto;
}

export interface CreateCaptureItemDto {
  text: string;
  source?: string;
  capturedAt?: string;
}

export type FeedbackRequestType = "bug" | "feature" | "general";
export type FeedbackRequestStatus =
  | "new"
  | "triaged"
  | "promoted"
  | "rejected"
  | "resolved";
export type FeedbackReviewAction =
  | "triaged"
  | "promoted"
  | "rejected"
  | "resolved";
export type FeedbackAutomationDecision = "review" | "promoted";
export type FeedbackTriageClassification =
  | "bug"
  | "feature"
  | "support"
  | "duplicate_candidate"
  | "noise";

export interface FeedbackAttachmentMetadataDto {
  name?: string | null;
  type?: string | null;
  size?: number | null;
  lastModified?: number | null;
}

export interface FeedbackTriageResultDto {
  classification: FeedbackTriageClassification;
  triageConfidence: number;
  normalizedTitle: string;
  normalizedBody: string;
  impactSummary?: string | null;
  reproSteps?: string[];
  expectedBehavior?: string | null;
  actualBehavior?: string | null;
  proposedOutcome?: string | null;
  labels: string[];
  missingInfo: string[];
}

export interface FeedbackDuplicateMatchDto {
  duplicateCandidate: boolean;
  matchedFeedbackIds: string[];
  matchedGithubIssueNumber?: number | null;
  matchedGithubIssueUrl?: string | null;
  duplicateReason?: string | null;
}

export type FeedbackPromotionIssueType = "bug" | "feature";

export interface FeedbackPromotionPreviewDto {
  issueType: FeedbackPromotionIssueType;
  title: string;
  body: string;
  labels: string[];
  sourceFeedbackIds: string[];
  canPromote: boolean;
  duplicateCandidate: boolean;
  duplicateReason?: string | null;
  existingGithubIssueNumber?: number | null;
  existingGithubIssueUrl?: string | null;
}

export interface FeedbackPromotionResultDto {
  issueNumber: number;
  issueUrl: string;
  promotedAt: string;
  preview: FeedbackPromotionPreviewDto;
}

export interface PromoteFeedbackRequestDto {
  ignoreDuplicateSuggestion?: boolean;
}

export interface FeedbackAutomationConfigDto {
  feedbackAutomationEnabled: boolean;
  feedbackAutoPromoteEnabled: boolean;
  feedbackAutoPromoteMinConfidence: number;
  allowlistedClassifications: Array<"bug" | "feature">;
}

export interface UpdateFeedbackAutomationConfigDto {
  feedbackAutomationEnabled?: boolean;
  feedbackAutoPromoteEnabled?: boolean;
  feedbackAutoPromoteMinConfidence?: number;
}

export interface FeedbackAutomationDecisionDto {
  id: string;
  title: string;
  type: FeedbackRequestType;
  status: FeedbackRequestStatus;
  classification?: FeedbackTriageClassification | null;
  triageConfidence?: number | null;
  promotionDecision: FeedbackAutomationDecision;
  promotionReason?: string | null;
  promotionRunId?: string | null;
  promotionDecidedAt: string;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
}

export interface RunFeedbackAutomationRequestDto {
  limit?: number;
}

export interface FeedbackAutomationRunResultDto {
  jobName: string;
  periodKey: string;
  runId?: string | null;
  claimed: boolean;
  skipped: boolean;
  reason?: string | null;
  processedCount: number;
  promotedCount: number;
  reviewCount: number;
  decisions: FeedbackAutomationDecisionDto[];
}

export type FeedbackRetryAction = "triage" | "duplicate_check" | "promotion";

export interface FeedbackFailureDto {
  id: string;
  actionType: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryable: boolean;
  retryCount: number;
  resolvedAt?: string | null;
  resolution?: string | null;
  createdAt: string;
  payload?: unknown;
}

export interface RetryAdminFeedbackRequestDto {
  action: FeedbackRetryAction;
  ignoreDuplicateSuggestion?: boolean;
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
  classification?: FeedbackTriageClassification | null;
  triageConfidence?: number | null;
  normalizedTitle?: string | null;
  normalizedBody?: string | null;
  impactSummary?: string | null;
  reproSteps?: string[];
  expectedBehavior?: string | null;
  actualBehavior?: string | null;
  proposedOutcome?: string | null;
  agentLabels?: string[];
  missingInfo?: string[];
  triageSummary?: string | null;
  severity?: string | null;
  dedupeKey?: string | null;
  duplicateCandidate?: boolean;
  matchedFeedbackIds?: string[];
  matchedGithubIssueNumber?: number | null;
  matchedGithubIssueUrl?: string | null;
  duplicateOfFeedbackId?: string | null;
  duplicateOfGithubIssueNumber?: number | null;
  duplicateOfGithubIssueUrl?: string | null;
  duplicateReason?: string | null;
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  promotedAt?: string | null;
  promotionDecision?: FeedbackAutomationDecision | null;
  promotionReason?: string | null;
  promotionRunId?: string | null;
  promotionDecidedAt?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFeedbackItemDto {
  id: string;
  type: FeedbackRequestType;
  title: string;
  status: FeedbackRequestStatus;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackRequestAdminUserDto {
  id: string;
  email: string | null;
  name?: string | null;
}

export interface FeedbackRequestAdminListItemDto extends FeedbackRequestDto {
  user: FeedbackRequestAdminUserDto;
  reviewer?: FeedbackRequestAdminUserDto | null;
}

export interface FeedbackRequestAdminDetailDto extends FeedbackRequestAdminListItemDto {}

export interface ListAdminFeedbackRequestsQuery {
  status?: FeedbackRequestStatus;
  type?: FeedbackRequestType;
}

export interface UpdateAdminFeedbackRequestDto {
  status: FeedbackReviewAction;
  rejectionReason?: string | null;
  ignoreDuplicateSuggestion?: boolean;
  duplicateOfFeedbackId?: string | null;
  duplicateOfGithubIssueNumber?: number | null;
  duplicateReason?: string | null;
}
