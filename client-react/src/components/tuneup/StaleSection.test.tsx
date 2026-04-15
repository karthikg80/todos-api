// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StaleSection } from "./StaleSection";

describe("StaleSection", () => {
  const noop = vi.fn();

  it("shows All clear when nothing visible", () => {
    render(
      ce(StaleSection, {
        staleTasks: [],
        staleProjects: [],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        patchedProjectIds: new Set(),
        onArchiveTask: noop,
        onSnoozeTask: noop,
        onArchiveProject: noop,
        onDismiss: noop,
        onOpenTask: noop,
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("hides dismissed and patched tasks", () => {
    render(
      ce(StaleSection, {
        staleTasks: [{ id: "t1", title: "Old task" }],
        staleProjects: [],
        dismissed: new Set(["stale:task:t1"]),
        patchedTaskIds: new Set(),
        patchedProjectIds: new Set(),
        onArchiveTask: noop,
        onSnoozeTask: noop,
        onArchiveProject: noop,
        onDismiss: noop,
        onOpenTask: noop,
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("renders task row actions", () => {
    const onOpenTask = vi.fn();
    const onSnoozeTask = vi.fn();
    const onArchiveTask = vi.fn();
    const onDismiss = vi.fn();
    render(
      ce(StaleSection, {
        staleTasks: [
          {
            id: "t1",
            title: "Stale",
            status: "inbox",
            lastUpdated: "2020-01-01T00:00:00.000Z",
          },
        ],
        staleProjects: [],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        patchedProjectIds: new Set(),
        onArchiveTask,
        onSnoozeTask,
        onArchiveProject: noop,
        onDismiss,
        onOpenTask,
      }),
    );
    expect(screen.getByText("Stale")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpenTask).toHaveBeenCalledWith("t1");
    fireEvent.click(screen.getByRole("button", { name: "Snooze 30d" }));
    expect(onSnoozeTask).toHaveBeenCalledWith("t1");
    fireEvent.click(screen.getAllByRole("button", { name: "Archive" })[0]!);
    expect(onArchiveTask).toHaveBeenCalledWith("t1");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("stale:task:t1");
  });

  it("renders project row actions", () => {
    const onArchiveProject = vi.fn();
    const onDismiss = vi.fn();
    render(
      ce(StaleSection, {
        staleTasks: [],
        staleProjects: [
          {
            id: "p1",
            name: "Old project",
            lastUpdated: "2020-01-02T00:00:00.000Z",
          },
        ],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        patchedProjectIds: new Set(),
        onArchiveTask: noop,
        onSnoozeTask: noop,
        onArchiveProject,
        onDismiss,
        onOpenTask: noop,
      }),
    );
    expect(screen.getByText("Old project")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchiveProject).toHaveBeenCalledWith("p1");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("stale:project:p1");
  });
});
