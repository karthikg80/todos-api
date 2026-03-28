type SanitizedContext = {
  pageUrl: string | null;
  appVersion: string | null;
  userAgent: string | null;
  screenshotNotice: string;
};

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+?\d[\d().\-\s]{7,}\d)/g;
const SECRET_PATTERN = /\b(?:sk|gh[opusr]|github_pat)_[A-Za-z0-9_\-]{8,}\b/g;
const INLINE_URL_PATTERN = /https?:\/\/[^\s)>\]]+/g;

function stripUrlQueryParams(match: string): string {
  try {
    const parsed = new URL(match);
    return `${parsed.origin}${parsed.pathname || "/"}`;
  } catch {
    return match;
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function redactSensitiveText(value: string | null | undefined): string {
  const normalized = String(value ?? "");
  if (!normalized.trim()) {
    return "";
  }

  return collapseWhitespace(
    normalized
      .replace(INLINE_URL_PATTERN, stripUrlQueryParams)
      .replace(EMAIL_PATTERN, "[redacted-email]")
      .replace(PHONE_PATTERN, "[redacted-phone]")
      .replace(SECRET_PATTERN, "[redacted-secret]"),
  );
}

export function sanitizeUrlForGitHubExport(
  value: string | null | undefined,
): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    const safePath = parsed.pathname || "/";
    return `${parsed.origin}${safePath}`;
  } catch {
    return redactSensitiveText(normalized) || null;
  }
}

export function summarizeUserAgentForGitHubExport(
  value: string | null | undefined,
): string | null {
  const userAgent = String(value ?? "").toLowerCase();
  if (!userAgent.trim()) {
    return null;
  }

  if (userAgent.includes("edg")) {
    return "Edge";
  }
  if (userAgent.includes("chrome") && !userAgent.includes("edg")) {
    return "Chrome";
  }
  if (userAgent.includes("firefox")) {
    return "Firefox";
  }
  if (userAgent.includes("safari") && !userAgent.includes("chrome")) {
    return "Safari";
  }
  if (userAgent.includes("playwright")) {
    return "Playwright";
  }

  return "Captured privately in app";
}

export function buildScreenshotNotice(
  screenshotUrl: string | null | undefined,
): string {
  return screenshotUrl
    ? "Screenshot captured privately in app review queue and intentionally omitted from GitHub export."
    : "No screenshot attached.";
}

export function sanitizeContextForGitHubExport(input: {
  pageUrl?: string | null;
  appVersion?: string | null;
  userAgent?: string | null;
  screenshotUrl?: string | null;
}): SanitizedContext {
  return {
    pageUrl: sanitizeUrlForGitHubExport(input.pageUrl),
    appVersion: redactSensitiveText(input.appVersion) || null,
    userAgent: summarizeUserAgentForGitHubExport(input.userAgent),
    screenshotNotice: buildScreenshotNotice(input.screenshotUrl),
  };
}
