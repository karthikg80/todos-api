import { sanitizeText, sanitizeTaskForAI } from "./services/contentSanitizer";

describe("sanitizeText", () => {
  it("should redact email addresses", () => {
    expect(sanitizeText("contact john@example.com now")).toBe(
      "contact [redacted-email] now",
    );
  });

  it("should redact phone numbers", () => {
    expect(sanitizeText("call +1 (555) 123-4567")).toBe(
      "call [redacted-phone]",
    );
  });

  it("should redact API secrets", () => {
    expect(sanitizeText("use sk_live_abc12345678")).toBe(
      "use [redacted-secret]",
    );
    expect(sanitizeText("token ghp_abcdefghij12345")).toBe(
      "token [redacted-secret]",
    );
    expect(sanitizeText("pat github_pat_abcdefghij")).toBe(
      "pat [redacted-secret]",
    );
  });

  it("should redact SSN patterns", () => {
    expect(sanitizeText("ssn 123-45-6789")).toBe("ssn [redacted-ssn]");
  });

  it("should strip URL query params", () => {
    const result = sanitizeText("visit https://example.com/path?secret=abc");
    expect(result).toBe("visit https://example.com/path");
  });

  it("should return empty string for null/undefined", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText("")).toBe("");
  });

  it("should pass through clean text unchanged", () => {
    expect(sanitizeText("Buy groceries for dinner")).toBe(
      "Buy groceries for dinner",
    );
  });
});

describe("sanitizeTaskForAI", () => {
  it("should sanitize title, description, and notes", () => {
    const result = sanitizeTaskForAI({
      title: "Email john@test.com about project",
      description: "Call +1-555-123-4567",
      notes: "Use sk_test_abcdefgh12 to authenticate",
    });

    expect(result.title).toBe("Email [redacted-email] about project");
    expect(result.description).toBe("Call [redacted-phone]");
    expect(result.notes).toBe("Use [redacted-secret] to authenticate");
  });

  it("should preserve other fields", () => {
    const result = sanitizeTaskForAI({
      title: "Clean task",
      description: null,
      notes: null,
      priority: "high",
      dueDate: "2026-04-01",
    } as any);

    expect(result.title).toBe("Clean task");
    expect(result.description).toBeNull();
    expect(result.notes).toBeNull();
    expect((result as any).priority).toBe("high");
    expect((result as any).dueDate).toBe("2026-04-01");
  });
});
