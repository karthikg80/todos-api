// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { TuneUpView } from "./TuneUpView";

const { createElement: ce } = React;

// Mock the useTuneUp hook
vi.mock("../../hooks/useTuneUp", () => ({
  useTuneUp: (opts: any) => ({
    data: {
      duplicates: {
        groups: [
          {
            id: "dup-1",
            title: "Duplicate group 1",
            tasks: [
              { id: "t1", title: "Task 1", status: "next", completed: false },
              { id: "t2", title: "Task 2", status: "next", completed: false },
            ],
          },
        ],
      },
      stale: {
        staleTasks: [{ id: "t3", title: "Stale task", reviewDate: "2026-01-01" }],
        staleProjects: [{ id: "p1", name: "Stale project", archivedAt: "2026-01-01" }],
      },
      quality: {
        results: [{ id: "t4", title: "Poor quality task", issues: ["vague"], suggestions: ["Be specific"] }],
      },
      taxonomy: {
        similarProjects: [{ id: "sim-1", projectAId: "p1", projectBId: "p2", projectAName: "Project A", projectBName: "Project B", reason: "Similar names" }],
        smallProjects: [{ id: "p3", name: "Small project", todoCount: 1 }],
      },
    },
    loading: { duplicates: false, stale: false, quality: false, taxonomy: false },
    error: { duplicates: null, stale: null, quality: null, taxonomy: null },
    dismissed: new Set(),
    patchedTaskIds: new Set(),
    patchedProjectIds: new Set(),
    hasFetched: true,
    refresh: vi.fn(),
    refreshSection: vi.fn(),
    dismiss: vi.fn(),
    load: vi.fn(),
    patchTaskOut: vi.fn(),
    unpatchTaskOut: vi.fn(),
    patchProjectOut: vi.fn(),
    unpatchProjectOut: vi.fn(),
    patchQualityResolved: vi.fn(),
    patchStaleResolved: vi.fn(),
    restoreStaleTask: vi.fn(),
  }),
}));

vi.mock("../../components/layout/ViewActivityContext", () => ({
  useViewActivity: () => ({ isActive: true }),
}));

vi.mock("../../api/client", () => ({
  apiCall: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

describe("TuneUpView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    onOpenTask: vi.fn(),
    onUndo: vi.fn(),
  };

  it("renders the Tune-up title", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Tune-up")).toBeTruthy();
    });
  });

  it("renders the refresh button", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Refresh all analyses" })).toBeTruthy();
    });
  });

  it("renders all four section headers", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeTruthy();
      expect(screen.getByText("Stale")).toBeTruthy();
      expect(screen.getByText("Quality")).toBeTruthy();
      expect(screen.getByText("Taxonomy")).toBeTruthy();
    });
  });

  it("renders duplicate section", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Duplicates")).toBeTruthy();
    });
  });

  it("renders stale tasks and projects", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Stale task")).toBeTruthy();
      expect(screen.getByText("Stale project")).toBeTruthy();
    });
  });

  it("renders quality issues", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Poor quality task")).toBeTruthy();
    });
  });

  it("renders taxonomy section", async () => {
    render(ce(TuneUpView, defaultProps));
    await waitFor(() => {
      expect(screen.getByText("Taxonomy")).toBeTruthy();
    });
  });
});
