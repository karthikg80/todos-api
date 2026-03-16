const ACTION_VERBS = new Set([
  "buy",
  "call",
  "send",
  "write",
  "read",
  "review",
  "schedule",
  "book",
  "fix",
  "update",
  "check",
  "draft",
  "prepare",
  "submit",
  "complete",
  "finish",
  "create",
  "build",
  "test",
  "deploy",
  "refactor",
  "add",
  "remove",
  "delete",
  "merge",
  "close",
  "open",
  "contact",
  "email",
  "research",
  "investigate",
  "plan",
  "organize",
  "clean",
  "sort",
  "discuss",
  "confirm",
  "follow",
  "set",
  "get",
  "make",
  "find",
  "move",
  "copy",
  "install",
  "configure",
  "document",
  "upload",
  "download",
  "publish",
  "cancel",
  "archive",
  "approve",
  "reject",
  "invite",
  "register",
  "verify",
  "report",
  "analyze",
  "design",
  "implement",
  "request",
  "order",
  "pay",
  "sign",
  "file",
  "print",
  "record",
  "backup",
  "restore",
  "monitor",
  "notify",
  "present",
  "remind",
  "track",
  "coordinate",
  "attend",
  "join",
]);

const VAGUE_VERB_PHRASES = [
  "look into",
  "handle",
  "deal with",
  "work on",
  "sort out",
  "think about",
  "figure out",
  "check on",
  "follow up",
  "take care of",
  "address",
  "tackle",
];

export interface TaskQualityResult {
  id: string;
  title: string;
  qualityScore: number;
  issues: string[];
  suggestions: string[];
}

export function analyzeTaskQuality(
  id: string,
  title: string,
): TaskQualityResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const lower = title.toLowerCase().trim();
  const firstWord = lower.split(/\s+/)[0];

  // Check 1: No action verb at start
  if (!ACTION_VERBS.has(firstWord)) {
    issues.push("Title does not start with a clear action verb");
    suggestions.push(
      `Start with a verb, e.g. "Review ${title}" or "Complete ${title}"`,
    );
  }

  // Check 2: Vague verb phrases
  const vagueMatch = VAGUE_VERB_PHRASES.find((phrase) =>
    lower.startsWith(phrase),
  );
  if (vagueMatch) {
    issues.push(`Starts with vague phrase "${vagueMatch}"`);
    suggestions.push(
      `Replace "${vagueMatch}" with a specific action like "Call", "Email", or "Review"`,
    );
  }

  // Check 3: Multiple actions
  const andCount = (lower.match(/\band\b/g) || []).length;
  const commaCount = (title.match(/,/g) || []).length;
  if (andCount > 1 || commaCount >= 3) {
    issues.push(
      "Title contains multiple actions — consider splitting into separate tasks",
    );
    suggestions.push("Create one task per action for clarity and trackability");
  }

  // Check 4: Too long
  if (title.length > 80) {
    issues.push(
      "Title is too long (>80 chars) — may be a project or multiple tasks",
    );
    suggestions.push("Break into subtasks or convert to a project");
  }

  // Check 5: Placeholder nouns
  if (/\b(stuff|things|misc|various|etc)\b/i.test(title)) {
    issues.push("Contains vague placeholder words (stuff/things/misc)");
    suggestions.push("Be specific about what needs to be done");
  }

  // Check 6: Looks like a project
  if (/^(project[: -]|phase\s+\d|milestone|sprint\s+\d|epic)/i.test(title)) {
    issues.push("Looks like a project or milestone, not an actionable task");
    suggestions.push("Convert to a project and add specific next actions");
  }

  const qualityScore = Math.max(1, 5 - issues.length);
  return { id, title, qualityScore, issues, suggestions };
}
