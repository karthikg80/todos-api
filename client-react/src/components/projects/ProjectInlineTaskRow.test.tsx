// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { Todo, Heading } from "../../types";

import { ProjectInlineTaskRow } from "./ProjectInlineTaskRow";

const { createElement: ce } = React;

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "t1",
    title: overrides.title ?? "Test task",
    description: null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: null,
    projectId: overrides.projectId ?? "p1",
    category: null,
    headingId: overrides.headingId ?? null,
    tags: [],
    context: null,
    energy: null,
    dueDate: null,
    startDate: null,
    scheduledDate: null,
    reviewDate: null,
    doDate: null,
    estimateMinutes: null,
    waitingOn: null,
    dependsOnTaskIds: [],
    order: 0,
    priority: null,
    archived: false,
    firstStep: null,
    emotionalState: null,
    effortScore: null,
    source: null,
    recurrence: { type: "none" },
    subtasks: [],
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const defaultHeadings: Heading[] = [
  { id: "h1", name: "Phase 1", projectId: "p1", sortOrder: 0 },
  { id: "h2", name: "Phase 2", projectId: "p1", sortOrder: 1 },
];

const defaultProps = {
  index: 0,
  todo: makeTodo(),
  projectId: "p1",
  headings: defaultHeadings,
  isBulkMode: false,
  selected: false,
  onSelect: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  onAddTodo: vi.fn().mockResolvedValue(undefined),
  onRequestDeleteTodo: vi.fn(),
};

describe("ProjectInlineTaskRow", () => {
  it("renders task title input", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByLabelText("Task title")).toBeTruthy();
    expect(screen.getByDisplayValue("Test task")).toBeTruthy();
  });

  it("renders task index", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renders status select with options", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByLabelText("Status")).toBeTruthy();
    expect(screen.getByText("Next up")).toBeTruthy();
  });

  it("renders effort display", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByText("Quick win")).toBeTruthy();
  });

  it("renders due date display", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByText("No date")).toBeTruthy();
  });

  it("renders notes textarea", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByPlaceholderText("Notes…")).toBeTruthy();
  });

  it("renders section select with Backlog and headings", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByText("Backlog")).toBeTruthy();
    expect(screen.getByText("Phase 1")).toBeTruthy();
    expect(screen.getByText("Phase 2")).toBeTruthy();
  });

  it("renders Duplicate and Delete buttons", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    expect(screen.getByText("Duplicate")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("calls onSave with new title on blur", async () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    const input = screen.getByLabelText("Task title");
    fireEvent.change(input, { target: { value: "Updated title" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("t1", { title: "Updated title" });
    });
  });

  it("calls onSave with new status on select change", async () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "waiting" } });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("t1", { status: "waiting" });
    });
  });

  it("calls onSave with new heading on section change", async () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    const sectionSelect = screen.getByLabelText("Section");
    fireEvent.change(sectionSelect, { target: { value: "h1" } });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("t1", { headingId: "h1" });
    });
  });

  it("calls onAddTodo with copied task on Duplicate click", async () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    fireEvent.click(screen.getByText("Duplicate"));

    await waitFor(() => {
      expect(defaultProps.onAddTodo).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Test task (copy)",
          projectId: "p1",
          headingId: null,
        }),
      );
    });
  });

  it("calls onRequestDeleteTodo on Delete click", () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    fireEvent.click(screen.getByText("Delete"));
    expect(defaultProps.onRequestDeleteTodo).toHaveBeenCalledWith("t1");
  });

  it("shows checkbox in bulk mode", () => {
    render(ce(ProjectInlineTaskRow, { ...defaultProps, isBulkMode: true }));
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("calls onSelect when checkbox is clicked in bulk mode", () => {
    render(ce(ProjectInlineTaskRow, { ...defaultProps, isBulkMode: true }));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(defaultProps.onSelect).toHaveBeenCalledWith("t1");
  });

  it("does not show checkbox outside bulk mode", () => {
    render(ce(ProjectInlineTaskRow, { ...defaultProps, isBulkMode: false }));
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("updates title draft when todo changes", () => {
    const { rerender } = render(ce(ProjectInlineTaskRow, defaultProps));
    fireEvent.change(screen.getByLabelText("Task title"), { target: { value: "Changed" } });

    // Re-render with different todo
    rerender(ce(ProjectInlineTaskRow, { ...defaultProps, todo: makeTodo({ id: "t2", title: "New task" }) }));
    expect(screen.getByDisplayValue("New task")).toBeTruthy();
  });

  it("saves notes on blur when changed", async () => {
    render(ce(ProjectInlineTaskRow, defaultProps));
    const textarea = screen.getByPlaceholderText("Notes…");
    fireEvent.change(textarea, { target: { value: "Some notes" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("t1", { notes: "Some notes" });
    });
  });

  it("saves null notes when textarea is cleared", async () => {
    // Start with existing notes so clearing triggers a save
    render(ce(ProjectInlineTaskRow, { ...defaultProps, todo: makeTodo({ notes: "Existing" }) }));
    const textarea = screen.getByPlaceholderText("Notes…");
    fireEvent.change(textarea, { target: { value: "" } });
    fireEvent.blur(textarea);

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalledWith("t1", { notes: null });
    });
  });
});
