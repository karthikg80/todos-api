/**
 * Shared content sanitizer for redacting PII before sending to external services.
 * Extracted from feedbackPrivacyService patterns; used by aiService before provider calls.
 */

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d().\-\s]{7,}\d)/g;
const SECRET_PATTERN = /\b(?:sk|gh[opusr]|github_pat)_[A-Za-z0-9_\-]{8,}\b/g;
const INLINE_URL_PATTERN = /https?:\/\/[^\s)>\]]+/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;

function stripUrlQueryParams(match: string): string {
  try {
    const parsed = new URL(match);
    return `${parsed.origin}${parsed.pathname || "/"}`;
  } catch {
    return match;
  }
}

/**
 * Redact PII patterns from text: emails, phones, secrets, SSNs,
 * credit card numbers, and URL query params.
 */
export function sanitizeText(value: string | null | undefined): string {
  const text = String(value ?? "").trim();
  if (!text) return "";

  return text
    .replace(SSN_PATTERN, "[redacted-ssn]")
    .replace(CREDIT_CARD_PATTERN, "[redacted-card]")
    .replace(SECRET_PATTERN, "[redacted-secret]")
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(PHONE_PATTERN, "[redacted-phone]")
    .replace(INLINE_URL_PATTERN, stripUrlQueryParams);
}

/**
 * Sanitize task fields before sending to an AI provider.
 * Returns a new object with redacted title, description, and notes.
 */
export function sanitizeTaskForAI<
  T extends {
    title?: string | null;
    description?: string | null;
    notes?: string | null;
  },
>(task: T): T {
  return {
    ...task,
    title: task.title ? sanitizeText(task.title) : task.title,
    description: task.description
      ? sanitizeText(task.description)
      : task.description,
    notes: task.notes ? sanitizeText(task.notes) : task.notes,
  };
}
