import { analyzeTaskQuality } from "../../src/ai/taskQualityAnalyzer";
import { findDuplicates } from "../../src/ai/duplicateDetector";
import type { TaskForDuplication } from "../../src/ai/duplicateDetector";
import taskQualityFixtures from "../fixtures/ai-workflows/task-quality.json";
import duplicateFixtures from "../fixtures/ai-workflows/duplicate-tasks.json";
import captureTriageFixtures from "../fixtures/ai-workflows/capture-triage.json";

// ---------------------------------------------------------------------------
// Inline the triage helper (same logic as agentExecutor.triageCaptureText)
// ---------------------------------------------------------------------------

const ACTION_VERB_RE =
  /^(buy|call|send|write|read|review|schedule|book|fix|update|check|draft|prepare|submit|complete|finish|create|build|test|deploy|refactor|add|remove|delete|merge|close|open|contact|email|research|investigate|plan|organize|clean|sort|discuss|confirm|follow|set|get|make|find|move|copy|install|configure|document|upload|download|publish|cancel|archive|approve|reject|invite|register|verify|report|analyze|design|implement|request|order|pay|sign|file|print|record|backup|restore|monitor|notify|present|remind|track|coordinate|attend|join)\b/i;

function triageCaptureText(text: string): {
  kind: "create_task" | "discard" | "convert_to_note";
  confidence: number;
} {
  const trimmed = text.trim();
  if (/^https?:\/\//.test(trimmed)) {
    return { kind: "convert_to_note", confidence: 0.8 };
  }
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 3 && !ACTION_VERB_RE.test(trimmed)) {
    return { kind: "discard", confidence: 0.6 };
  }
  if (ACTION_VERB_RE.test(trimmed)) {
    return { kind: "create_task", confidence: 0.85 };
  }
  return { kind: "create_task", confidence: 0.5 };
}

// ---------------------------------------------------------------------------
// Task quality eval
// ---------------------------------------------------------------------------

describe("Eval: task quality analyzer", () => {
  for (const fixture of taskQualityFixtures) {
    it(fixture.description, () => {
      const result = analyzeTaskQuality(fixture.input.id, fixture.input.title);

      if ("qualityScore" in fixture.expected) {
        expect(result.qualityScore).toBe(fixture.expected.qualityScore);
      }
      if ("qualityScoreMax" in fixture.expected) {
        expect(result.qualityScore).toBeLessThanOrEqual(
          fixture.expected.qualityScoreMax as number,
        );
      }
      if ("issueCount" in fixture.expected) {
        expect(result.issues).toHaveLength(
          fixture.expected.issueCount as number,
        );
      }
      if ("issueContains" in fixture.expected) {
        const issueContains = fixture.expected.issueContains as string;
        const found = result.issues.some((i) =>
          i.toLowerCase().includes(issueContains.toLowerCase()),
        );
        expect(found).toBe(true);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Duplicate detection eval
// ---------------------------------------------------------------------------

describe("Eval: duplicate task detector", () => {
  for (const fixture of duplicateFixtures) {
    it(fixture.description, () => {
      const tasks = fixture.input as TaskForDuplication[];
      const groups = findDuplicates(tasks);

      expect(groups).toHaveLength(fixture.expected.groupCount);

      if (fixture.expected.groupCount > 0) {
        const first = groups[0];
        if ("firstGroupConfidence" in fixture.expected) {
          expect(first.confidence).toBe(fixture.expected.firstGroupConfidence);
        }
        if ("firstGroupConfidenceMin" in fixture.expected) {
          expect(first.confidence).toBeGreaterThanOrEqual(
            fixture.expected.firstGroupConfidenceMin as number,
          );
        }
        if ("firstGroupAction" in fixture.expected) {
          expect(first.suggestedAction).toBe(fixture.expected.firstGroupAction);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Capture triage eval
// ---------------------------------------------------------------------------

describe("Eval: capture triage heuristic", () => {
  for (const fixture of captureTriageFixtures) {
    it(fixture.description, () => {
      const result = triageCaptureText(fixture.input.text);

      expect(result.kind).toBe(fixture.expected.kind);

      if ("confidenceMin" in fixture.expected) {
        expect(result.confidence).toBeGreaterThanOrEqual(
          fixture.expected.confidenceMin as number,
        );
      }
      if ("confidenceMax" in fixture.expected) {
        expect(result.confidence).toBeLessThanOrEqual(
          fixture.expected.confidenceMax as number,
        );
      }
    });
  }
});
