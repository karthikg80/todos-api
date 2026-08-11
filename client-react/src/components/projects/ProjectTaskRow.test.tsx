// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as ce } from "react";
import { ProjectTaskRow } from "./ProjectTaskRow";

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => undefined,
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));
vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => "" } },
}));

const todo = {
  id: "t1",
  title: "Write tests",
  completed: false,
  dueDate: null,
  status: "inbox" as const,
  priority: null,
  order: 0,
  sortOrder: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  userId: "u1",
  projectId: null,
  headingId: null,
  tags: [],
  notes: null,
  scheduledFor: null,
  dependsOnTaskIds: [],
  archived: false,
};

const baseProps = {
  todo,
  menuId: "todo:t1",
  bulkMode: false,
  selectedIds: new Set<string>(),
  openMenuId: null,
  isDropTarget: false,
  onToggle: vi.fn(),
  onSelect: vi.fn(),
  onTaskOpen: vi.fn(),
  onRequestDeleteTodo: vi.fn(),
  onSetOpenMenuId: vi.fn(),
};

describe("ProjectTaskRow", () => {
  it("renders the task title", () => {
    render(ce(ProjectTaskRow, baseProps));
    expect(screen.getByRole("button", { name: "Write tests" })).toBeTruthy();
  });

  it("calls onTaskOpen when the title button is clicked", () => {
    const onTaskOpen = vi.fn();
    render(ce(ProjectTaskRow, { ...baseProps, onTaskOpen }));
    fireEvent.click(screen.getByRole("button", { name: "Write tests" }));
    expect(onTaskOpen).toHaveBeenCalledWith("t1");
  });

  it("calls onToggle when checkbox is changed in non-bulk mode", () => {
    const onToggle = vi.fn();
    render(ce(ProjectTaskRow, { ...baseProps, onToggle }));
    fireEvent.click(screen.getByRole("checkbox", { name: /complete/i }));
    expect(onToggle).toHaveBeenCalledWith("t1", true);
  });

  it("calls onSelect when checkbox is changed in bulk mode", () => {
    const onSelect = vi.fn();
    render(ce(ProjectTaskRow, { ...baseProps, bulkMode: true, onSelect }));
    fireEvent.click(screen.getByRole("checkbox", { name: /select/i }));
    expect(onSelect).toHaveBeenCalledWith("t1");
  });

  it("opens the row menu when the kebab button is clicked", () => {
    const onSetOpenMenuId = vi.fn();
    render(ce(ProjectTaskRow, { ...baseProps, onSetOpenMenuId }));
    fireEvent.click(screen.getByRole("button", { name: "Task actions" }));
    expect(onSetOpenMenuId).toHaveBeenCalledWith("todo:t1");
  });

  it("does not render Move to backlog for non-nested rows", () => {
    render(ce(ProjectTaskRow, { ...baseProps, openMenuId: "todo:t1" }));
    expect(
      screen.queryByRole("button", { name: /move to backlog/i }),
    ).toBeNull();
  });

  it("renders Move to backlog for nested rows and calls onMoveToBacklog", () => {
    const onMoveToBacklog = vi.fn();
    render(
      ce(ProjectTaskRow, {
        ...baseProps,
        nested: true,
        openMenuId: "todo:t1",
        onMoveToBacklog,
      }),
    );
    const btn = screen.getByRole("button", { name: /move to backlog/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onMoveToBacklog).toHaveBeenCalledOnce();
  });
});
