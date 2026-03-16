/**
 * Records how a task/project mutation was decided.
 * Attached to agent audit logs and AI write operations.
 */
export type DecisionSource =
  | "manual"
  | "ai-suggestion-accepted"
  | "deterministic-rule"
  | "import";

export interface RationaleMetadata {
  decisionSource: DecisionSource;
  rationale?: string;
  modelVersion?: string; // e.g. "claude-sonnet-4-6" — only for AI-generated
  entityRefs?: string[];
}
