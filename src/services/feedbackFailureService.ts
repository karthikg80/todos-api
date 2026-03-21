import {
  FailedActionRecord,
  FailedAutomationActionService,
} from "./failedAutomationActionService";

export type FeedbackFailureAction =
  | "feedback.triage"
  | "feedback.duplicate_search"
  | "feedback.promotion";

function buildFeedbackPeriodKey(feedbackId: string): string {
  return feedbackId.replace(/-/g, "").slice(0, 20);
}

export class FeedbackFailureService {
  constructor(
    private readonly failedActionService: FailedAutomationActionService,
  ) {}

  async record(input: {
    userId: string;
    feedbackId: string;
    actionType: FeedbackFailureAction;
    errorCode?: string;
    errorMessage?: string;
    payload?: unknown;
    retryable?: boolean;
  }): Promise<FailedActionRecord | null> {
    return this.failedActionService.record({
      userId: input.userId,
      jobName: "feedback_pipeline",
      periodKey: buildFeedbackPeriodKey(input.feedbackId),
      actionType: input.actionType,
      entityType: "feedback",
      entityId: input.feedbackId,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      payload: input.payload,
      retryable: input.retryable ?? true,
    });
  }

  async listForFeedback(feedbackId: string): Promise<FailedActionRecord[]> {
    return this.failedActionService.listByEntity("feedback", feedbackId, {
      includeResolved: true,
      limit: 20,
    });
  }

  async listOpenForFeedback(
    feedbackId: string,
    actionType?: FeedbackFailureAction,
  ): Promise<FailedActionRecord[]> {
    return this.failedActionService.listByEntity("feedback", feedbackId, {
      actionType,
      includeResolved: false,
      limit: 20,
    });
  }

  async resolveOpenForFeedback(
    feedbackId: string,
    actionType: FeedbackFailureAction,
  ): Promise<void> {
    const openFailures = await this.listOpenForFeedback(feedbackId, actionType);
    await Promise.all(
      openFailures.map((failure) =>
        this.failedActionService.resolveById(failure.id, "retried"),
      ),
    );
  }
}
