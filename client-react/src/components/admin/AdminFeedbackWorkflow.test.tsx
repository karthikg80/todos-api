// @vitest-environment jsdom
// @ts-nocheck — complex component with many dependencies
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import React from "react";
import { AdminFeedbackWorkflow } from "./AdminFeedbackWorkflow";
import * as apiClient from "../../api/client";

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

const mockApiCall = vi.mocked(apiClient.apiCall);

// Mock child components
vi.mock("./FeedbackTriagePage", () => ({
  FeedbackTriagePage: ({ feedbackId, onBack }: any) =>
    React.createElement("div", { "data-testid": "feedback-triage-page", "data-feedback-id": feedbackId },
      React.createElement("button", { onClick: onBack }, "Back to queue"),
      React.createElement("span", null, `Triage: ${feedbackId}`),
    ),
}));

function setupMocks(overrides: {
  feedbackList?: any[];
  config?: any;
  decisions?: any[];
} = {}) {
  const {
    feedbackList = [
      { id: "fb-1", title: "Bug report 1", type: "bug", status: "new", createdAt: "2026-04-10T10:00:00Z", userId: "u1" },
    ],
    config = {
      feedbackAutomationEnabled: false,
      feedbackAutoPromoteEnabled: false,
      feedbackAutoPromoteMinConfidence: 0.7,
      allowlistedClassifications: ["bug", "feature"],
    },
    decisions = [],
  } = overrides;

  mockApiCall.mockImplementation(async (url: string) => {
    if (url.includes("/feedback/automation/config")) {
      return { ok: true, json: async () => config };
    }
    if (url.includes("/feedback/automation/decisions")) {
      return { ok: true, json: async () => decisions };
    }
    if (url.includes("/feedback/automation/run")) {
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/admin/feedback") && !url.includes("/automation")) {
      if (!url.includes("/fb-")) {
        return { ok: true, json: async () => feedbackList };
      }
      const feedbackId = url.split("/feedback/")[1]?.split("/")[0];
      const item = feedbackList.find((f) => f.id === feedbackId);
      return { ok: !!item, json: async () => item || {} };
    }
    return { ok: true, json: async () => ({}) };
  });
}

describe("AdminFeedbackWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  describe("initial rendering", () => {
    it("renders the page title", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Feedback Queue")).toBeTruthy();
      });
    });

    it("renders feedback list items", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
    });

    it("shows feedback type pills", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("bug")).toBeTruthy();
      });
    });

    it("shows feedback status pills", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("new")).toBeTruthy();
      });
    });
  });

  describe("empty state", () => {
    it("shows empty message when no feedback items", async () => {
      setupMocks({ feedbackList: [] });
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText(/No feedback/i)).toBeTruthy();
      });
    });
  });
});
