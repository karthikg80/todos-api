import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import {
  formatDate,
  statusLabel,
  statusClass,
  typeLabel,
  typeClass,
} from "../utils/feedbackHelpers";

// Note: These are pure helper functions extracted from FeedbackView.tsx.
// Testing them separately gives high coverage on the logic with minimal setup.

describe("FeedbackView helper functions", () => {
  describe("formatDate", () => {
    it("formats a valid ISO date string", () => {
      const result = formatDate("2026-04-07T00:00:00.000Z");
      // Date formatting depends on timezone, just check it contains expected parts
      expect(result).toMatch(/Apr \d{1,2}, 2026/);
    });

    it("returns 'Invalid Date' for invalid dates", () => {
      expect(formatDate("not-a-date")).toBe("Invalid Date");
    });
  });

  describe("statusLabel", () => {
    it("maps 'new' to 'Submitted'", () => {
      expect(statusLabel("new")).toBe("Submitted");
    });

    it("maps 'triaged' to 'Under review'", () => {
      expect(statusLabel("triaged")).toBe("Under review");
    });

    it("maps 'promoted' to 'Tracked'", () => {
      expect(statusLabel("promoted")).toBe("Tracked");
    });

    it("maps 'rejected' to 'Closed'", () => {
      expect(statusLabel("rejected")).toBe("Closed");
    });

    it("maps 'resolved' to 'Resolved'", () => {
      expect(statusLabel("resolved")).toBe("Resolved");
    });

    it("returns unknown statuses as-is", () => {
      expect(statusLabel("unknown")).toBe("unknown");
    });
  });

  describe("statusClass", () => {
    it("returns correct class for 'new'", () => {
      expect(statusClass("new")).toBe("feedback-list__status--new");
    });

    it("returns correct class for 'triaged'", () => {
      expect(statusClass("triaged")).toBe("feedback-list__status--triaged");
    });

    it("returns correct class for 'promoted'", () => {
      expect(statusClass("promoted")).toBe("feedback-list__status--promoted");
    });

    it("returns default class for 'rejected'", () => {
      expect(statusClass("rejected")).toBe("feedback-list__status--new");
    });

    it("returns default class for unknown", () => {
      expect(statusClass("unknown")).toBe("feedback-list__status--new");
    });
  });

  describe("typeLabel", () => {
    it("maps 'bug' to 'Bug'", () => {
      expect(typeLabel("bug")).toBe("Bug");
    });

    it("maps 'feature' to 'Feature'", () => {
      expect(typeLabel("feature")).toBe("Feature");
    });

    it("maps 'general' to 'Feedback'", () => {
      expect(typeLabel("general")).toBe("Feedback");
    });

    it("returns unknown types as-is", () => {
      expect(typeLabel("other")).toBe("other");
    });
  });

  describe("typeClass", () => {
    it("returns correct class for 'bug'", () => {
      expect(typeClass("bug")).toBe("feedback-list__type--bug");
    });

    it("returns correct class for 'feature'", () => {
      expect(typeClass("feature")).toBe("feedback-list__type--feature");
    });

    it("returns default class for other types", () => {
      expect(typeClass("general")).toBe("feedback-list__type--bug");
    });
  });
});
