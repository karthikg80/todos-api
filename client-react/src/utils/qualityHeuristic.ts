/**
 * Best-effort heuristic for whether a task title passes basic quality checks.
 * Uses the same verb set as the backend's taskQualityAnalyzer.ts.
 * This is a v1 approximation — not a correctness rule.
 */

const ACTION_VERBS = new Set([
  "add", "book", "build", "buy", "call", "check", "clean", "close",
  "complete", "confirm", "contact", "create", "delete", "deploy",
  "discuss", "draft", "email", "finish", "fix", "follow", "investigate",
  "merge", "open", "organize", "plan", "prepare", "read", "refactor",
  "remove", "research", "review", "schedule", "send", "set", "sort",
  "submit", "test", "update", "write",
]);

const SPLIT_WORDS = new Set(["and", "then", "also", "plus"]);

export function titlePassesQuality(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;

  const firstWord = trimmed.split(/\s+/)[0].toLowerCase();
  if (!ACTION_VERBS.has(firstWord)) return false;

  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.some((w) => SPLIT_WORDS.has(w))) return false;

  return true;
}
