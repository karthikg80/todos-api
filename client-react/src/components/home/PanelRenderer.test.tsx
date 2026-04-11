// @vitest-environment jsdom
// @ts-nocheck — createElement overload issues with complex mocked props
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PanelRenderer } from "./PanelRenderer";

const { createElement: ce } = React;

// Mock sub-components
vi.mock("./FlipCard", () => ({
  FlipCard: ({ front, back }) => ce("div", { "data-testid": "flip-card" }, front, back),
}));

vi.mock("./TarotCard", () => ({
  TarotCardFront: ({ name, children, illustrationCaption }) => ce("div", { "data-testid": "tarot-front", "data-name": name }, ce("h2", null, name), illustrationCaption && ce("span", { "data-testid": "illustration-caption" }, illustrationCaption), children),
  TarotCardBack: ({ name, children }) => ce("div", { "data-testid": "tarot-back", "data-name": name }, ce("h2", null, "Back: " + name), children),
}));

vi.mock("./CardBack", () => ({
  CardBackContent: ({ reason }) => ce("div", { "data-testid": "card-back-content" }, reason),
}));

vi.mock("./pixel-art", () => ({
  PANEL_ART: {
    unsorted: () => ce("div", { "data-testid": "art-unsorted" }),
    dueSoon: () => ce("div", { "data-testid": "art-dueSoon" }),
    whatNext: () => ce("div", { "data-testid": "art-whatNext" }),
    backlogHygiene: () => ce("div", { "data-testid": "art-backlogHygiene" }),
    projectsToNudge: () => ce("div", { "data-testid": "art-projectsToNudge" }),
    trackOverview: () => ce("div", { "data-testid": "art-trackOverview" }),
    rescueMode: () => ce("div", { "data-testid": "art-rescueMode" }),
  },
}));

vi.mock("../../agents/useAgentProfiles", () => ({
  useAgentProfiles: () => [],
  getAgentProfile: () => undefined,
}));

const basePanel = (type: string, data: any = {}) => ({
  type,
  data,
  reason: "Test reason",
  provenance: { source: "deterministic" as const },
});

const noop = () => {};

describe("PanelRenderer", () => {
  it("returns null for unknown panel type", () => {
    const { container } = render(
      ce(PanelRenderer, { panel: basePanel("unknown"), onTaskClick: noop, onSelectProject: noop }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders UnsortedPanel for unsorted type", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("unsorted", { items: [] }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("The Inbox")).toBeTruthy();
  });

  it("shows All clear when unsorted has no items", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("unsorted", { items: [] }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("All clear!")).toBeTruthy();
  });

  it("shows task title and edit buttons when unsorted has items", () => {
    const onTaskClick = vi.fn();
    const onEditTodo = vi.fn();
    render(
      ce(PanelRenderer, {
        panel: basePanel("unsorted", {
          items: [{ id: "t1", title: "Test task" }],
        }),
        onTaskClick,
        onSelectProject: noop,
        onEditTodo,
      }),
    );
    expect(screen.getByText("Test task")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    expect(onEditTodo).toHaveBeenCalledWith("t1", { status: "next" });
  });

  it("renders DueSoonPanel for dueSoon type", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("dueSoon", {
          groups: [
            { label: "Overdue", items: [{ id: "t1", title: "Late", dueDate: "2026-01-01", overdue: true }] },
            { label: "Today", items: [{ id: "t2", title: "Due today", dueDate: "2026-04-10" }] },
          ],
        }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("The Hourglass")).toBeTruthy();
    // The illustration caption shows "2 tasks due"
    expect(screen.getByTestId("illustration-caption").textContent).toContain("2 tasks");
  });

  it("renders WhatNextPanel for whatNext type", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("whatNext", {
          items: [
            { id: "t1", title: "Do this first", reason: "High impact", impact: "high", effort: "low" },
            { id: "t2", title: "Then this", reason: "Medium impact", impact: "medium", effort: "medium" },
          ],
        }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("The Compass")).toBeTruthy();
    expect(screen.getByText("Do this first")).toBeTruthy();
  });

  it("renders BacklogHygienePanel for backlogHygiene type", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("backlogHygiene", {
          items: [{ id: "t1", title: "Stale task", staleDays: 45 }],
        }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("The Web")).toBeTruthy();
    expect(screen.getByText("Stale task")).toBeTruthy();
    expect(screen.getByText("45d untouched")).toBeTruthy();
  });

  it("renders ProjectsToNudgePanel for projectsToNudge type", () => {
    const onSelectProject = vi.fn();
    render(
      ce(PanelRenderer, {
        panel: basePanel("projectsToNudge", {
          items: [{ id: "p1", name: "At Risk Project", overdueCount: 3, waitingCount: 1, dueSoonCount: 2 }],
        }),
        onTaskClick: noop,
        onSelectProject,
      }),
    );
    expect(screen.getByText("The Guardian")).toBeTruthy();
    expect(screen.getByText("At Risk Project")).toBeTruthy();
    fireEvent.click(screen.getByText("At Risk Project").closest("button")!);
    expect(onSelectProject).toHaveBeenCalledWith("p1");
  });

  it("renders TrackOverviewPanel for trackOverview type", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("trackOverview", {
          columns: {
            thisWeek: [{ id: "t1", title: "This week task" }],
            next14Days: [{ id: "t2", title: "Next 14 task" }],
            later: [{ id: "t3", title: "Later task" }],
          },
        }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("The Road")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("Next 14 days")).toBeTruthy();
    expect(screen.getByText("Later")).toBeTruthy();
  });

  it("renders RescueModePanel when thresholds exceeded", () => {
    render(
      ce(PanelRenderer, {
        panel: basePanel("rescueMode", { openCount: 50, overdueCount: 20 }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(screen.getByText("Rescue")).toBeTruthy();
    expect(screen.getByText(/50/)).toBeTruthy();
    expect(screen.getByText(/20/)).toBeTruthy();
  });

  it("returns null for RescueModePanel when thresholds not met", () => {
    const { container } = render(
      ce(PanelRenderer, {
        panel: basePanel("rescueMode", { openCount: 5, overdueCount: 1 }),
        onTaskClick: noop,
        onSelectProject: noop,
      }),
    );
    expect(container.firstChild).toBeNull();
  });
});
