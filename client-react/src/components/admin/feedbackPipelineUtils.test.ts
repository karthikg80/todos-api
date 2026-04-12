// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  formatDateTime,
  formatConfidence,
  derivePipeline,
  deriveQueueGroups,
  aiSuggestionLabel,
  aiStripVariant,
  mapFailureRetryAction,
  mapFailureActionLabel,
} from "./feedbackPipelineUtils";

describe("feedbackPipelineUtils", () => {
  describe("formatDateTime", () => {
    it("returns Unknown for null", () => {
      expect(formatDateTime(null)).toBe("Unknown");
    });

    it("returns Unknown for undefined", () => {
      expect(formatDateTime(undefined)).toBe("Unknown");
    });

    it("returns Unknown for invalid date string", () => {
      expect(formatDateTime("not-a-date")).toBe("Unknown");
    });

    it("formats a valid ISO date string", () => {
      const result = formatDateTime("2026-04-10T12:00:00.000Z");
      expect(result).not.toBe("Unknown");
      expect(result).toContain("2026");
    });
  });

  describe("formatConfidence", () => {
    it("returns Unknown for null", () => {
      expect(formatConfidence(null)).toBe("Unknown");
    });

    it("returns Unknown for undefined", () => {
      expect(formatConfidence(undefined)).toBe("Unknown");
    });

    it("formats confidence as percentage", () => {
      expect(formatConfidence(0.85)).toBe("85%");
    });

    it("rounds to nearest integer", () => {
      expect(formatConfidence(0.854)).toBe("85%");
      expect(formatConfidence(0.856)).toBe("86%");
    });

    it("handles 0 and 1", () => {
      expect(formatConfidence(0)).toBe("0%");
      expect(formatConfidence(1)).toBe("100%");
    });
  });

  describe("derivePipeline", () => {
    it("returns pending for new item", () => {
      const state = derivePipeline({
        status: "new",
        classification: null,
        duplicateCandidate: null,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.terminal).toBe(false);
      expect(state.nextAction).toEqual({ label: "Run triage", stage: "triage" });
      expect(state.stages).toEqual({
        triage: "pending",
        dedup: "pending",
        promote: "pending",
      });
    });

    it("returns triage done, dedup pending after classification", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: null,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.terminal).toBe(false);
      expect(state.nextAction).toEqual({ label: "Check duplicates", stage: "dedup" });
      expect(state.stages.triage).toBe("done");
      expect(state.stages.dedup).toBe("pending");
    });

    it("returns dedup done, promote pending after dedup", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: false,
        matchedFeedbackIds: [],
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.terminal).toBe(false);
      expect(state.nextAction).toEqual({ label: "Promote to GitHub", stage: "promote" });
      expect(state.stages.triage).toBe("done");
      expect(state.stages.dedup).toBe("done");
    });

    it("returns terminal for rejected item", () => {
      const state = derivePipeline({
        status: "rejected",
        classification: null,
        duplicateCandidate: null,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.terminal).toBe(true);
      expect(state.nextAction).toBeNull();
    });

    it("returns terminal for promoted item", () => {
      const state = derivePipeline({
        status: "promoted",
        classification: "bug",
        duplicateCandidate: false,
        matchedFeedbackIds: [],
        matchedGithubIssueNumber: null,
        githubIssueNumber: 123,
      });
      expect(state.terminal).toBe(true);
      expect(state.nextAction).toBeNull();
      expect(state.stages.promote).toBe("done");
    });

    it("detects promotion via githubIssueNumber even without promoted status", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: false,
        matchedFeedbackIds: [],
        matchedGithubIssueNumber: 42,
        githubIssueNumber: 42,
      });
      expect(state.terminal).toBe(true);
      expect(state.stages.promote).toBe("done");
    });

    it("detects dedup via matchedFeedbackIds", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: null,
        matchedFeedbackIds: ["fb-1", "fb-2"],
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.stages.dedup).toBe("done");
      expect(state.nextAction).toEqual({ label: "Promote to GitHub", stage: "promote" });
    });

    it("detects dedup via matchedGithubIssueNumber", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: null,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: 99,
        githubIssueNumber: null,
      });
      expect(state.stages.dedup).toBe("done");
    });

    it("detects dedup via duplicateCandidate flag", () => {
      const state = derivePipeline({
        status: "triaged",
        classification: "bug",
        duplicateCandidate: true,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.stages.dedup).toBe("done");
    });

    it("skips triage stage for rejected item without classification", () => {
      const state = derivePipeline({
        status: "rejected",
        classification: null,
        duplicateCandidate: null,
        matchedFeedbackIds: null,
        matchedGithubIssueNumber: null,
        githubIssueNumber: null,
      });
      expect(state.stages.triage).toBe("skipped");
      expect(state.stages.dedup).toBe("skipped");
      expect(state.stages.promote).toBe("skipped");
    });
  });

  describe("deriveQueueGroups", () => {
    it("returns empty array for empty items", () => {
      expect(deriveQueueGroups([])).toEqual([]);
    });

    it("groups items by status", () => {
      const items = [
        { id: "t1", status: "new", classification: null, githubIssueNumber: null },
        { id: "t2", status: "triaged", classification: "bug", githubIssueNumber: null },
        { id: "t3", status: "promoted", classification: "bug", githubIssueNumber: 1 },
        { id: "t4", status: "rejected", classification: null, githubIssueNumber: null },
      ];
      const groups = deriveQueueGroups(items);
      expect(groups).toHaveLength(4);
      expect(groups[0].key).toBe("needs-triage");
      expect(groups[0].items).toHaveLength(1);
      expect(groups[1].key).toBe("triaged");
      expect(groups[1].items).toHaveLength(1);
      expect(groups[2].key).toBe("promoted");
      expect(groups[2].items).toHaveLength(1);
      expect(groups[3].key).toBe("rejected");
      expect(groups[3].items).toHaveLength(1);
    });

    it("omits empty groups", () => {
      const items = [
        { id: "t1", status: "new", classification: null, githubIssueNumber: null },
      ];
      const groups = deriveQueueGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe("needs-triage");
    });

    it("classifies items with githubIssueNumber as promoted regardless of status", () => {
      const items = [
        { id: "t1", status: "triaged", classification: "bug", githubIssueNumber: 42 },
      ];
      const groups = deriveQueueGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe("promoted");
    });

    it("classifies items with classification as triaged", () => {
      const items = [
        { id: "t1", status: "triaged", classification: "bug", githubIssueNumber: null },
      ];
      const groups = deriveQueueGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe("triaged");
    });

    it("classifies items without classification as needs-triage", () => {
      const items = [
        { id: "t1", status: "new", classification: null, githubIssueNumber: null },
        { id: "t2", status: "new", classification: null, githubIssueNumber: null },
      ];
      const groups = deriveQueueGroups(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].key).toBe("needs-triage");
      expect(groups[0].items).toHaveLength(2);
    });
  });

  describe("aiSuggestionLabel", () => {
    it("returns Promote for high confidence", () => {
      expect(aiSuggestionLabel(0.8)).toBe("Promote");
      expect(aiSuggestionLabel(0.95)).toBe("Promote");
    });

    it("returns Review for medium confidence", () => {
      expect(aiSuggestionLabel(0.5)).toBe("Review");
      expect(aiSuggestionLabel(0.79)).toBe("Review");
    });

    it("returns Reject for low confidence", () => {
      expect(aiSuggestionLabel(0.49)).toBe("Reject");
      expect(aiSuggestionLabel(0.1)).toBe("Reject");
    });
  });

  describe("aiStripVariant", () => {
    it("returns none for null", () => {
      expect(aiStripVariant(null)).toBe("none");
    });

    it("returns none for undefined", () => {
      expect(aiStripVariant(undefined)).toBe("none");
    });

    it("returns promote for high confidence", () => {
      expect(aiStripVariant(0.8)).toBe("promote");
    });

    it("returns review for medium confidence", () => {
      expect(aiStripVariant(0.5)).toBe("review");
    });

    it("returns reject for low confidence", () => {
      expect(aiStripVariant(0.3)).toBe("reject");
    });
  });

  describe("mapFailureRetryAction", () => {
    it("maps triage action type", () => {
      expect(mapFailureRetryAction("feedback.triage")).toBe("triage");
    });

    it("maps duplicate_search action type", () => {
      expect(mapFailureRetryAction("feedback.duplicate_search")).toBe("duplicate_check");
    });

    it("maps promotion action type", () => {
      expect(mapFailureRetryAction("feedback.promotion")).toBe("promotion");
    });

    it("returns empty string for unknown type", () => {
      expect(mapFailureRetryAction("unknown")).toBe("");
    });
  });

  describe("mapFailureActionLabel", () => {
    it("maps triage action type", () => {
      expect(mapFailureActionLabel("feedback.triage")).toBe("Retry triage");
    });

    it("maps duplicate_search action type", () => {
      expect(mapFailureActionLabel("feedback.duplicate_search")).toBe("Retry duplicate check");
    });

    it("maps promotion action type", () => {
      expect(mapFailureActionLabel("feedback.promotion")).toBe("Retry promotion");
    });

    it("returns generic Retry for unknown type", () => {
      expect(mapFailureActionLabel("unknown")).toBe("Retry");
    });
  });
});
