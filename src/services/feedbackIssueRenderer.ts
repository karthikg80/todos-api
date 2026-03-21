import {
  FeedbackPromotionIssueType,
  FeedbackPromotionPreviewDto,
} from "../types";

type PromotionRenderRecord = {
  id: string;
  type: "bug" | "feature" | "general";
  status: "new" | "triaged" | "promoted" | "rejected";
  classification:
    | "bug"
    | "feature"
    | "support"
    | "duplicate_candidate"
    | "noise"
    | null;
  normalizedTitle: string | null;
  normalizedBody: string | null;
  impactSummary: string | null;
  reproStepsJson: unknown;
  expectedBehavior: string | null;
  actualBehavior: string | null;
  proposedOutcome: string | null;
  triageSummary: string | null;
  missingInfoJson: unknown;
  agentLabelsJson: unknown;
  pageUrl: string | null;
  appVersion: string | null;
  userAgent: string | null;
  screenshotUrl: string | null;
  duplicateCandidate: boolean;
  duplicateReason: string | null;
  duplicateOfFeedbackId: string | null;
  duplicateOfGithubIssueNumber: number | null;
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
};

function coerceStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function issueTypeForRecord(
  record: PromotionRenderRecord,
): FeedbackPromotionIssueType | null {
  if (record.classification === "bug" || record.classification === "feature") {
    return record.classification;
  }
  if (record.type === "bug" || record.type === "feature") {
    return record.type;
  }
  return null;
}

function cleanText(
  value: string | null | undefined,
  fallback = "Not provided",
): string {
  const normalized = (value || "").trim();
  return normalized || fallback;
}

function toBulletList(items: string[], fallback: string): string {
  if (!items.length) {
    return `- ${fallback}`;
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function extractAreaLabels(record: PromotionRenderRecord): string[] {
  const haystack = [
    record.normalizedTitle,
    record.normalizedBody,
    record.impactSummary,
    record.pageUrl,
    record.userAgent,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const areaLabels = new Set<string>();
  if (
    /\b(ui|button|drawer|modal|sheet|screen|layout|page|tooltip|header|footer|mobile web)\b/.test(
      haystack,
    )
  ) {
    areaLabels.add("ui");
  }
  if (
    /\b(auth|login|logout|password|verification|oauth|sign in|sign-in)\b/.test(
      haystack,
    )
  ) {
    areaLabels.add("auth");
  }
  if (/\b(mobile|ios|android|iphone|ipad|touch|responsive)\b/.test(haystack)) {
    areaLabels.add("mobile");
  }
  if (
    /\b(slow|latency|performance|lag|freeze|frozen|timeout|time out|loading)\b/.test(
      haystack,
    )
  ) {
    areaLabels.add("performance");
  }

  for (const label of coerceStringArray(record.agentLabelsJson)) {
    if (["ui", "auth", "mobile", "performance"].includes(label)) {
      areaLabels.add(label);
    }
  }

  return Array.from(areaLabels).sort();
}

function buildLabels(
  record: PromotionRenderRecord,
  issueType: FeedbackPromotionIssueType,
): string[] {
  return [issueType, "triaged-by-agent", ...extractAreaLabels(record)];
}

function buildContextSection(record: PromotionRenderRecord): string {
  const missingInfo = coerceStringArray(record.missingInfoJson);
  return [
    "## Context",
    `- Source feedback IDs: \`${record.id}\``,
    `- Feedback status: ${record.status}`,
    `- Page URL: ${cleanText(record.pageUrl)}`,
    `- App version: ${cleanText(record.appVersion)}`,
    `- Browser user agent: ${cleanText(record.userAgent)}`,
    `- Screenshot URL: ${cleanText(record.screenshotUrl)}`,
    `- Missing information flags: ${
      missingInfo.length ? missingInfo.join(", ") : "none"
    }`,
  ].join("\n");
}

function buildBugBody(record: PromotionRenderRecord): string {
  const reproSteps = coerceStringArray(record.reproStepsJson);
  return [
    "## Summary",
    cleanText(record.triageSummary || record.normalizedBody),
    "",
    "## Impact",
    cleanText(record.impactSummary),
    "",
    "## Steps To Reproduce",
    toBulletList(
      reproSteps,
      "Not enough information provided to reproduce yet.",
    ),
    "",
    "## Expected Behavior",
    cleanText(record.expectedBehavior),
    "",
    "## Actual Behavior",
    cleanText(record.actualBehavior),
    "",
    buildContextSection(record),
  ].join("\n");
}

function buildFeatureBody(record: PromotionRenderRecord): string {
  return [
    "## Problem",
    cleanText(
      record.impactSummary || record.triageSummary || record.normalizedBody,
    ),
    "",
    "## Proposed Outcome",
    cleanText(record.proposedOutcome),
    "",
    "## Current Experience",
    cleanText(record.normalizedBody),
    "",
    "## Success Criteria",
    toBulletList(
      [record.proposedOutcome, record.impactSummary].filter(
        (value): value is string => Boolean(value && value.trim()),
      ),
      "Define measurable success criteria during implementation planning.",
    ),
    "",
    buildContextSection(record),
  ].join("\n");
}

export function renderFeedbackIssuePreview(
  record: PromotionRenderRecord,
): FeedbackPromotionPreviewDto {
  const issueType = issueTypeForRecord(record);
  if (!issueType) {
    throw new Error(
      "Feedback must be triaged as bug or feature before promotion",
    );
  }
  if (!record.normalizedTitle || !record.normalizedBody) {
    throw new Error("Feedback must be triaged before promotion");
  }
  if (record.duplicateOfFeedbackId || record.duplicateOfGithubIssueNumber) {
    throw new Error("Confirmed duplicates cannot be promoted");
  }

  const title = record.normalizedTitle.trim();
  const body =
    issueType === "bug" ? buildBugBody(record) : buildFeatureBody(record);

  return {
    issueType,
    title,
    body,
    labels: buildLabels(record, issueType),
    sourceFeedbackIds: [record.id],
    canPromote: !record.duplicateCandidate && !record.githubIssueNumber,
    duplicateCandidate: record.duplicateCandidate,
    duplicateReason: record.duplicateReason,
    existingGithubIssueNumber: record.githubIssueNumber,
    existingGithubIssueUrl: record.githubIssueUrl,
  };
}
