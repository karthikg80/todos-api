// Pure utility functions extracted from AdminFeedbackWorkflow and FeedbackTriagePage
// for isolated testability.

export type PipelineStage = "triage" | "dedup" | "promote";

export interface PipelineState {
  stages: Record<PipelineStage, "done" | "pending" | "skipped">;
  nextAction: { label: string; stage: PipelineStage } | null;
  terminal: boolean;
}

export interface QueueItemLike {
  status: string;
  classification?: string | null;
  duplicateCandidate?: boolean | null;
  matchedFeedbackIds?: string[] | null;
  matchedGithubIssueNumber?: number | null;
  githubIssueNumber?: number | null;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export function formatConfidence(value: number | null | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "Unknown";
}

export function derivePipeline(item: QueueItemLike): PipelineState {
  const isRejected = item.status === "rejected";
  const isPromoted = item.status === "promoted" || !!item.githubIssueNumber;
  const isTriaged = !!item.classification;
  const isDeduped =
    item.duplicateCandidate != null ||
    (Array.isArray(item.matchedFeedbackIds) &&
      item.matchedFeedbackIds.length > 0) ||
    item.matchedGithubIssueNumber != null;

  if (isRejected) {
    return {
      stages: {
        triage: isTriaged ? "done" : "skipped",
        dedup: isDeduped ? "done" : "skipped",
        promote: "skipped",
      },
      nextAction: null,
      terminal: true,
    };
  }

  if (isPromoted) {
    return {
      stages: { triage: "done", dedup: isDeduped ? "done" : "skipped", promote: "done" },
      nextAction: null,
      terminal: true,
    };
  }

  if (!isTriaged) {
    return {
      stages: { triage: "pending", dedup: "pending", promote: "pending" },
      nextAction: { label: "Run triage", stage: "triage" },
      terminal: false,
    };
  }

  if (!isDeduped) {
    return {
      stages: { triage: "done", dedup: "pending", promote: "pending" },
      nextAction: { label: "Check duplicates", stage: "dedup" },
      terminal: false,
    };
  }

  return {
    stages: { triage: "done", dedup: "done", promote: "pending" },
    nextAction: { label: "Promote to GitHub", stage: "promote" },
    terminal: false,
  };
}

export interface QueueGroupLike {
  key: string;
  label: string;
  items: Array<{
    id: string;
    status: string;
    classification?: string | null;
    githubIssueNumber?: number | null;
  }>;
}

export function deriveQueueGroups(
  items: Array<{
    id: string;
    status: string;
    classification?: string | null;
    githubIssueNumber?: number | null;
  }>,
): QueueGroupLike[] {
  const needsTriage: typeof items = [];
  const triaged: typeof items = [];
  const promoted: typeof items = [];
  const rejected: typeof items = [];

  for (const item of items) {
    if (item.status === "rejected") {
      rejected.push(item);
    } else if (item.githubIssueNumber || item.status === "promoted") {
      promoted.push(item);
    } else if (item.classification) {
      triaged.push(item);
    } else {
      needsTriage.push(item);
    }
  }

  return [
    { key: "needs-triage", label: "Needs triage", items: needsTriage },
    { key: "triaged", label: "Triaged", items: triaged },
    { key: "promoted", label: "Promoted", items: promoted },
    { key: "rejected", label: "Rejected", items: rejected },
  ].filter((g) => g.items.length > 0);
}

export function aiSuggestionLabel(confidence: number): string {
  if (confidence >= 0.8) return "Promote";
  if (confidence >= 0.5) return "Review";
  return "Reject";
}

export function aiStripVariant(confidence: number | null | undefined): string {
  if (confidence == null) return "none";
  if (confidence >= 0.8) return "promote";
  if (confidence >= 0.5) return "review";
  return "reject";
}

export function mapFailureRetryAction(actionType: string): string {
  if (actionType === "feedback.triage") return "triage";
  if (actionType === "feedback.duplicate_search") return "duplicate_check";
  if (actionType === "feedback.promotion") return "promotion";
  return "";
}

export function mapFailureActionLabel(actionType: string): string {
  if (actionType === "feedback.triage") return "Retry triage";
  if (actionType === "feedback.duplicate_search") return "Retry duplicate check";
  if (actionType === "feedback.promotion") return "Retry promotion";
  return "Retry";
}
