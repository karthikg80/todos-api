// @ts-nocheck — complex mocked useTuneUp returns functions that do not match exact production types
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import React from "react";
import { TuneUpView } from "./TuneUpView";

const { createElement: ce } = React;

// Mock the child section components
vi.mock("../layout/SectionHeader", () => ({
  SectionHeader: ({ title, count, onToggle, onRetry, error }: any) =>
    React.createElement(
      "div",
      {
        "data-testid": `section-header-${title.toLowerCase()}`,
        "data-count": count,
      },
      React.createElement("button", { onClick: onToggle }, `Toggle ${title}`),
      error && React.createElement("button", { onClick: onRetry }, "Retry"),
      error &&
        React.createElement("span", { "data-testid": "section-error" }, error),
      React.createElement("span", null, title),
    ),
}));

vi.mock("./DuplicatesSection", () => ({
  DuplicatesSection: ({ groups }: any) =>
    React.createElement(
      "div",
      { "data-testid": "duplicates-section" },
      groups.map((g: any) =>
        React.createElement(
          "div",
          { key: g.id, "data-testid": `dup-group-${g.id}` },
          React.createElement("span", null, g.title),
        ),
      ),
    ),
}));

vi.mock("./StaleSection", () => ({
  StaleSection: () =>
    React.createElement("div", { "data-testid": "stale-section" }),
}));

vi.mock("./QualitySection", () => ({
  QualitySection: ({ issues }: any) =>
    React.createElement(
      "div",
      { "data-testid": "quality-section" },
      issues.map((q: any) =>
        React.createElement(
          "div",
          { key: q.id, "data-testid": `quality-issue-${q.id}` },
          React.createElement("span", null, q.title),
        ),
      ),
    ),
}));

vi.mock("./TaxonomySection", () => ({
  TaxonomySection: () =>
    React.createElement("div", { "data-testid": "taxonomy-section" }),
}));

// Mock the useTuneUp hook
vi.mock("../../hooks/useTuneUp", () => ({
  useTuneUp: vi.fn(),
}));

vi.mock("../../components/layout/ViewActivityContext", () => ({
  useViewActivity: () => ({ isActive: true }),
}));

vi.mock("../../api/client", () => ({
  apiCall: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

import { useTuneUp } from "../../hooks/useTuneUp";

const mockUseTuneUp = vi.mocked(useTuneUp);

function setupTuneUp(
  overrides: {
    data?: any;
    loading?: any;
    error?: any;
    hasFetched?: boolean;
    dismiss?: ReturnType<typeof vi.fn>;
    refresh?: ReturnType<typeof vi.fn>;
    refreshSection?: ReturnType<typeof vi.fn>;
    patchTaskOut?: ReturnType<typeof vi.fn>;
    unpatchTaskOut?: ReturnType<typeof vi.fn>;
    patchProjectOut?: ReturnType<typeof vi.fn>;
    unpatchProjectOut?: ReturnType<typeof vi.fn>;
    patchQualityResolved?: ReturnType<typeof vi.fn>;
    patchStaleResolved?: ReturnType<typeof vi.fn>;
    restoreStaleTask?: ReturnType<typeof vi.fn>;
    load?: ReturnType<typeof vi.fn>;
  } = {},
) {
  mockUseTuneUp.mockReturnValue({
    data: overrides.data ?? {
      duplicates: { groups: [] },
      stale: { staleTasks: [], staleProjects: [] },
      quality: { results: [] },
      taxonomy: { similarProjects: [], smallProjects: [] },
    },
    loading: overrides.loading ?? {
      duplicates: false,
      stale: false,
      quality: false,
      taxonomy: false,
    },
    error: overrides.error ?? {
      duplicates: null,
      stale: null,
      quality: null,
      taxonomy: null,
    },
    dismissed: new Set(),
    patchedTaskIds: new Set(),
    patchedProjectIds: new Set(),
    hasFetched: overrides.hasFetched ?? true,
    dismiss: overrides.dismiss ?? vi.fn(),
    refresh: overrides.refresh ?? vi.fn(),
    refreshSection: overrides.refreshSection ?? vi.fn(),
    patchTaskOut: overrides.patchTaskOut ?? vi.fn(),
    unpatchTaskOut: overrides.unpatchTaskOut ?? vi.fn(),
    patchProjectOut: overrides.patchProjectOut ?? vi.fn(),
    unpatchProjectOut: overrides.unpatchProjectOut ?? vi.fn(),
    patchQualityResolved: overrides.patchQualityResolved ?? vi.fn(),
    patchStaleResolved: overrides.patchStaleResolved ?? vi.fn(),
    restoreStaleTask: overrides.restoreStaleTask ?? vi.fn(),
    load: overrides.load ?? vi.fn(),
  });
}

const defaultProps = {
  onOpenTask: vi.fn(),
  onUndo: vi.fn(),
};

describe("TuneUpView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupTuneUp();
  });

  describe("core rendering", () => {
    it("renders the Tune-up title", async () => {
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByText("Tune-up")).toBeTruthy();
      });
    });

    it("renders the refresh button", async () => {
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Refresh all analyses" }),
        ).toBeTruthy();
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
  });

  describe("loading state", () => {
    it("shows skeleton rows when sections are loading", () => {
      setupTuneUp({
        loading: {
          duplicates: true,
          stale: true,
          quality: true,
          taxonomy: true,
        },
        hasFetched: false,
      });
      render(ce(TuneUpView, defaultProps));
      // Each loading section renders SkeletonRows (3 rows each)
      const skeletons = document.querySelectorAll(".skeleton__row");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("error state", () => {
    it("shows error alert when duplicates section has error", () => {
      setupTuneUp({
        error: {
          duplicates: "Failed to load",
          stale: null,
          quality: null,
          taxonomy: null,
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      expect(screen.getByTestId("section-error")).toBeTruthy();
    });

    it("shows error alert when stale section has error", () => {
      setupTuneUp({
        error: {
          duplicates: null,
          stale: "Stale error",
          quality: null,
          taxonomy: null,
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      expect(screen.getByTestId("section-error")).toBeTruthy();
    });

    it("shows error alert when quality section has error", () => {
      setupTuneUp({
        error: {
          duplicates: null,
          stale: null,
          quality: "Quality error",
          taxonomy: null,
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      expect(screen.getByTestId("section-error")).toBeTruthy();
    });

    it("shows error alert when taxonomy section has error", () => {
      setupTuneUp({
        error: {
          duplicates: null,
          stale: null,
          quality: null,
          taxonomy: "Taxonomy error",
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      expect(screen.getByTestId("section-error")).toBeTruthy();
    });
  });

  describe("section collapse/expand", () => {
    it("collapses a section when header is clicked", async () => {
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeTruthy();
      });
      // Click the collapse toggle (the header button)
      const header = screen.getByText("Duplicates").closest(".tuneup-section");
      const toggleBtn = header?.querySelector("button");
      fireEvent.click(toggleBtn!);
      // Section body should be hidden
      const section = document.querySelector('[data-section="duplicates"]');
      expect(section?.querySelector(".tuneup-section__body")).toBeNull();
    });

    it("expands a collapsed section when header is clicked again", async () => {
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByText("Duplicates")).toBeTruthy();
      });
      const header = screen.getByText("Duplicates").closest(".tuneup-section");
      const toggleBtn = header?.querySelector("button");
      // Collapse
      fireEvent.click(toggleBtn!);
      // Expand
      fireEvent.click(toggleBtn!);
      const section = document.querySelector('[data-section="duplicates"]');
      expect(section?.querySelector(".tuneup-section__body")).toBeTruthy();
    });
  });

  describe("refresh", () => {
    it("calls refresh when refresh button is clicked", async () => {
      const refresh = vi.fn();
      setupTuneUp({ refresh });
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Refresh all analyses" }),
        ).toBeTruthy();
      });
      fireEvent.click(
        screen.getByRole("button", { name: "Refresh all analyses" }),
      );
      expect(refresh).toHaveBeenCalled();
    });

    it("calls refreshSection when retry button is clicked for a section with error", async () => {
      const refreshSection = vi.fn();
      setupTuneUp({
        error: {
          duplicates: "Failed",
          stale: null,
          quality: null,
          taxonomy: null,
        },
        hasFetched: true,
        refreshSection,
      });
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByTestId("section-error")).toBeTruthy();
      });
      // Click the retry button
      const retryBtn = screen.getByRole("button", { name: /Retry/i });
      fireEvent.click(retryBtn);
      expect(refreshSection).toHaveBeenCalledWith("duplicates");
    });
  });

  describe("visible counts", () => {
    it("renders duplicates section when data is present", async () => {
      setupTuneUp({
        data: {
          duplicates: {
            groups: [
              {
                id: "dup-1",
                title: "Dup 1",
                tasks: [
                  { id: "t1", title: "T1" },
                  { id: "t2", title: "T2" },
                ],
              },
            ],
          },
          stale: { staleTasks: [], staleProjects: [] },
          quality: { results: [] },
          taxonomy: { similarProjects: [], smallProjects: [] },
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByTestId("duplicates-section")).toBeTruthy();
      });
    });

    it("renders quality section when data is present", async () => {
      setupTuneUp({
        data: {
          duplicates: { groups: [] },
          stale: { staleTasks: [], staleProjects: [] },
          quality: {
            results: [
              {
                id: "q1",
                title: "Bad title",
                issues: ["short"],
                suggestions: [],
              },
            ],
          },
          taxonomy: { similarProjects: [], smallProjects: [] },
        },
        hasFetched: true,
      });
      render(ce(TuneUpView, defaultProps));
      await waitFor(() => {
        expect(screen.getByTestId("quality-section")).toBeTruthy();
      });
    });
  });

  describe("initial data load", () => {
    it("does not call load when hasFetched is true", () => {
      const load = vi.fn();
      setupTuneUp({ hasFetched: true, load });
      render(ce(TuneUpView, defaultProps));
      expect(load).not.toHaveBeenCalled();
    });

    it("calls load when hasFetched is false and isActive is true", () => {
      const load = vi.fn();
      setupTuneUp({ hasFetched: false, load });
      render(ce(TuneUpView, defaultProps));
      expect(load).toHaveBeenCalled();
    });
  });
});
