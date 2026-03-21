import {
  FeedbackTriageClassification,
  FeedbackTriageResultDto,
} from "../types";
import { ValidationError } from "./validation";

const ALLOWED_CLASSIFICATIONS: FeedbackTriageClassification[] = [
  "bug",
  "feature",
  "support",
  "duplicate_candidate",
  "noise",
];
const MAX_TEXT_LENGTH = 4000;
const MAX_LABELS = 10;
const MAX_STEPS = 12;
const MAX_MISSING_FLAGS = 10;

function assertObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOptionalString(
  value: unknown,
  field: string,
  maxLength = MAX_TEXT_LENGTH,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new ValidationError(`${field} must be a string`);
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (normalized.length > maxLength) {
    throw new ValidationError(`${field} cannot exceed ${maxLength} characters`);
  }
  return normalized;
}

function assertRequiredString(
  value: unknown,
  field: string,
  maxLength = MAX_TEXT_LENGTH,
): string {
  const normalized = assertOptionalString(value, field, maxLength);
  if (!normalized) {
    throw new ValidationError(`${field} cannot be empty`);
  }
  return normalized;
}

function assertStringArray(
  value: unknown,
  field: string,
  maxItems: number,
  maxItemLength: number,
): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array of strings`);
  }
  if (value.length > maxItems) {
    throw new ValidationError(`${field} cannot exceed ${maxItems} items`);
  }

  const normalized = value.map((item, index) =>
    assertRequiredString(item, `${field}[${index}]`, maxItemLength),
  );

  return Array.from(new Set(normalized));
}

function assertConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError("triageConfidence must be a number");
  }
  if (value < 0 || value > 1) {
    throw new ValidationError("triageConfidence must be between 0 and 1");
  }
  return Number(value.toFixed(3));
}

export function validateFeedbackTriageOutput(
  value: unknown,
): FeedbackTriageResultDto {
  const output = assertObject(value, "triageOutput");
  const classification = output.classification;

  if (
    typeof classification !== "string" ||
    !ALLOWED_CLASSIFICATIONS.includes(
      classification as FeedbackTriageClassification,
    )
  ) {
    throw new ValidationError(
      "classification must be bug, feature, support, duplicate_candidate, or noise",
    );
  }

  return {
    classification: classification as FeedbackTriageClassification,
    triageConfidence: assertConfidence(output.triageConfidence),
    normalizedTitle: assertRequiredString(
      output.normalizedTitle,
      "normalizedTitle",
      200,
    ),
    normalizedBody: assertRequiredString(
      output.normalizedBody,
      "normalizedBody",
    ),
    impactSummary: assertOptionalString(output.impactSummary, "impactSummary"),
    reproSteps: assertStringArray(
      output.reproSteps,
      "reproSteps",
      MAX_STEPS,
      500,
    ),
    expectedBehavior: assertOptionalString(
      output.expectedBehavior,
      "expectedBehavior",
    ),
    actualBehavior: assertOptionalString(
      output.actualBehavior,
      "actualBehavior",
    ),
    proposedOutcome: assertOptionalString(
      output.proposedOutcome,
      "proposedOutcome",
    ),
    labels: assertStringArray(output.labels, "labels", MAX_LABELS, 60),
    missingInfo: assertStringArray(
      output.missingInfo,
      "missingInfo",
      MAX_MISSING_FLAGS,
      80,
    ),
  };
}
