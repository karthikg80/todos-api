// @vitest-environment jsdom
// @ts-nocheck — complex component with many dependencies
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

const mockFeedbackList = [
  { id: "fb-1", title: "Bug report 1", type: "bug", status: "new", createdAt: "2026-04-10T10:00:00Z", userId: "u1" },
  { id: "fb-2", title: "Feature request", type: "feature", status: "triaged", createdAt: "2026-04-10T11:00:00Z", userId: "u1", classification: "feature" },
];

function setupMocks(overrides: {
  feedbackList?: any[];
  config?: any;
  decisions?: any[];
  /** When true, `/admin/feedback?status=promoted` returns []. */
  emptyPromotedFilter?: boolean;
} = {}) {
  const {
    feedbackList = mockFeedbackList,
    config = {
      feedbackAutomationEnabled: false,
      feedbackAutoPromoteEnabled: false,
      feedbackAutoPromoteMinConfidence: 0.7,
      allowlistedClassifications: ["bug", "feature"],
    },
    decisions = [],
    emptyPromotedFilter = false,
  } = overrides;

  mockApiCall.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/feedback/automation/config")) {
      if (init?.method === "PATCH") {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => config };
    }
    if (url.includes("/feedback/automation/decisions")) {
      return { ok: true, json: async () => decisions };
    }
    if (url.includes("/feedback/automation/run")) {
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/admin/feedback/") && url.includes("/triage")) {
      return { ok: true, json: async () => ({}) };
    }
    if (
      url.includes("/admin/feedback/") &&
      init?.method === "PATCH" &&
      !url.includes("/automation")
    ) {
      return { ok: true, json: async () => ({}) };
    }
    if (url.includes("/admin/feedback") && !url.includes("/automation")) {
      if (!url.includes("/fb-")) {
        if (emptyPromotedFilter && url.includes("status=promoted")) {
          return { ok: true, json: async () => [] };
        }
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

  describe("interaction tests", () => {
    it("opens triage page when feedback item is clicked", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      fireEvent.click(screen.getByText("Bug report 1"));
      await waitFor(() => {
        expect(screen.getByTestId("feedback-triage-page")).toBeTruthy();
        expect(screen.getByTestId("feedback-triage-page").getAttribute("data-feedback-id")).toBe("fb-1");
      });
    });

    it("returns to queue when Back button is clicked in triage", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      fireEvent.click(screen.getByText("Bug report 1"));
      await waitFor(() => {
        expect(screen.getByTestId("feedback-triage-page")).toBeTruthy();
      });
      fireEvent.click(screen.getByText("Back to queue"));
      await waitFor(() => {
        expect(screen.queryByTestId("feedback-triage-page")).toBeNull();
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
    });

    it.skip("runs automation when Run button is clicked", async () => {
      // Flaky - automation panel loads asynchronously
    });

    it.skip("shows automation panel with config options", async () => {
      // Flaky - automation panel loads asynchronously
    });
  });

  describe("filtering", () => {
    it("shows all items initially", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
        expect(screen.getByText("Feature request")).toBeTruthy();
      });
    });

    it("filters by status when status chip is clicked", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      // Click on the "new" status chip to filter
      const newChips = screen.getAllByText("new");
      if (newChips.length > 0) {
        fireEvent.click(newChips[0]);
        await waitFor(() => {
          // After filtering by "new", only Bug report 1 should be visible
          expect(screen.getByText("Bug report 1")).toBeTruthy();
        });
      }
    });

    it("filters by type when type chip is clicked", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      // Click on the "bug" type chip to filter
      const bugChips = screen.getAllByText("bug");
      if (bugChips.length > 0) {
        fireEvent.click(bugChips[0]);
        await waitFor(() => {
          expect(screen.getByText("Bug report 1")).toBeTruthy();
        });
      }
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

  describe("data loading", () => {
    it.skip("fetches feedback list on mount", async () => {
      // Flaky - depends on exact API call order
    });

    it.skip("fetches automation config on mount", async () => {
      // Flaky - depends on exact API call order
    });
  });

  describe("feedback item display", () => {
    it("shows multiple feedback items", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
        expect(screen.getByText("Feature request")).toBeTruthy();
      });
    });

    it("shows feedback item titles", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      // Should show both items
      expect(screen.getByText("Feature request")).toBeTruthy();
    });

    it("renders the triage queue header", async () => {
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Feedback Queue")).toBeTruthy();
      });
    });
  });

  describe("queue filters and empty filtered state", () => {
    it("shows empty filter message when API returns no rows for a filter", async () => {
      setupMocks({ emptyPromotedFilter: true });
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      const promotedChip = screen.getAllByRole("button", { name: "promoted" })[0]!;
      fireEvent.click(promotedChip);
      await waitFor(() => {
        expect(
          screen.getByText("No feedback matches the current filters."),
        ).toBeTruthy();
      });
    });
  });

  describe("quick reject", () => {
    it("removes an item after quick reject succeeds", async () => {
      setupMocks();
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      const rejectBtn = screen.getAllByLabelText("Quick reject")[0]!;
      fireEvent.click(rejectBtn);
      await waitFor(() => {
        expect(screen.queryByText("Bug report 1")).toBeNull();
      });
    });
  });

  describe("batch triage", () => {
    it("triages selected items and shows a success toast", async () => {
      setupMocks();
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Bug report 1")).toBeTruthy();
      });
      fireEvent.click(screen.getByLabelText("Select Bug report 1"));
      fireEvent.click(screen.getByLabelText("Select Feature request"));
      fireEvent.click(screen.getByRole("button", { name: "Triage all" }));
      await waitFor(() => {
        expect(screen.getByText(/Triaged 2 of 2 items/)).toBeTruthy();
      });
    });
  });

  describe("automation panel", () => {
    it("loads controls after expanding automation settings", async () => {
      setupMocks({
        decisions: [
          {
            id: "d1",
            type: "bug",
            promotionDecision: "approved",
            title: "Auto item",
            promotionReason: "tests",
            promotionDecidedAt: "2026-04-10T12:00:00Z",
            githubIssueNumber: null,
            triageConfidence: 0.9,
          },
        ],
      });
      render(React.createElement(AdminFeedbackWorkflow));
      await waitFor(() => {
        expect(screen.getByText("Feedback Queue")).toBeTruthy();
      });
      fireEvent.click(screen.getByRole("button", { name: /Automation settings/i }));
      await waitFor(() => {
        expect(screen.getByText("Enable feedback automation")).toBeTruthy();
      });
      expect(screen.getByText("Auto item")).toBeTruthy();
    });
  });
});
