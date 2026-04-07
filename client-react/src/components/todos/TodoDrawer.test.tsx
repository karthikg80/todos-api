// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoDrawer } from "./TodoDrawer";
import type { Todo, Project } from "../../types";

const makeTodo = (overrides: Partial<Todo> = {}): Todo => ({
  id: overrides.id ?? "todo-1",
  title: overrides.title ?? "Test task",
  description: overrides.description ?? null,
  notes: overrides.notes ?? null,
  status: overrides.status ?? "next",
  completed: overrides.completed ?? false,
  completedAt: overrides.completedAt ?? null,
  projectId: overrides.projectId ?? null,
  category: overrides.category ?? null,
  headingId: overrides.headingId ?? null,
  tags: overrides.tags ?? [],
  context: overrides.context ?? null,
  energy: overrides.energy ?? null,
  dueDate: overrides.dueDate ?? null,
  startDate: overrides.startDate ?? null,
  scheduledDate: overrides.scheduledDate ?? null,
  reviewDate: overrides.reviewDate ?? null,
  doDate: overrides.doDate ?? null,
  estimateMinutes: overrides.estimateMinutes ?? null,
  waitingOn: overrides.waitingOn ?? null,
  dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
  order: overrides.order ?? 0,
  priority: overrides.priority ?? null,
  archived: overrides.archived ?? false,
  firstStep: overrides.firstStep ?? null,
  emotionalState: overrides.emotionalState ?? null,
  effortScore: overrides.effortScore ?? null,
  source: overrides.source ?? null,
  recurrence: overrides.recurrence ?? null,
  subtasks: overrides.subtasks ?? undefined,
  userId: overrides.userId ?? "user-1",
  createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

describe("TodoDrawer", () => {
  const defaultTodo = makeTodo();
  const defaultProps = {
    todo: defaultTodo,
    projects: [] as Project[],
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn(),
  };

  it("renders nothing when todo is null", () => {
    render(createElement(TodoDrawer, { ...defaultProps, todo: null }));
    const drawer = document.getElementById("todoDetailsDrawer");
    expect(drawer?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the todo title in the input", () => {
    render(createElement(TodoDrawer, defaultProps));
    const titleInput = document.getElementById("drawerTitleInput") as HTMLInputElement;
    expect(titleInput.value).toBe("Test task");
  });

  it("calls onClose when close button is clicked", () => {
    render(createElement(TodoDrawer, defaultProps));
    fireEvent.click(document.getElementById("todoDrawerClose")!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    render(createElement(TodoDrawer, defaultProps));
    fireEvent.click(document.querySelector(".todo-drawer-backdrop")!);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onClose when Escape key is pressed", () => {
    render(createElement(TodoDrawer, defaultProps));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("calls onDelete when delete button is clicked", () => {
    render(createElement(TodoDrawer, defaultProps));
    fireEvent.click(document.getElementById("drawerDeleteTodoButton")!);
    expect(defaultProps.onDelete).toHaveBeenCalledWith("todo-1");
  });

  it("shows saving status while save is in progress", async () => {
    let resolveSave: () => void;
    const savePromise = new Promise<void>((r) => {
      resolveSave = r;
    });
    const onSave = vi.fn().mockReturnValue(savePromise);
    render(createElement(TodoDrawer, { ...defaultProps, onSave }));

    // Trigger a field save
    const titleInput = document.getElementById("drawerTitleInput") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Edited" } });
    fireEvent.blur(titleInput);

    expect(onSave).toHaveBeenCalled();
    expect(document.getElementById("drawerSaveStatus")?.textContent).toBe("Saving…");

    resolveSave!();
    await waitFor(() => {
      expect(document.getElementById("drawerSaveStatus")?.textContent).toBe("Saved");
    });
  });

  it("shows error status when save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    render(createElement(TodoDrawer, { ...defaultProps, onSave }));

    const titleInput = document.getElementById("drawerTitleInput") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Edited" } });
    fireEvent.blur(titleInput);

    await waitFor(() => {
      expect(document.getElementById("drawerSaveStatus")?.textContent).toBe("Error saving");
    });
  });

  it("does not save when title is unchanged", () => {
    render(createElement(TodoDrawer, defaultProps));

    const titleInput = document.getElementById("drawerTitleInput") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Test task" } });
    fireEvent.blur(titleInput);

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("does not save when title is empty", () => {
    render(createElement(TodoDrawer, defaultProps));

    const titleInput = document.getElementById("drawerTitleInput") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "   " } });
    fireEvent.blur(titleInput);

    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("calls onOpenFullPage when link is clicked", () => {
    const onOpenFullPage = vi.fn();
    render(createElement(TodoDrawer, { ...defaultProps, onOpenFullPage }));

    fireEvent.click(screen.getByText("View all fields →"));
    expect(onOpenFullPage).toHaveBeenCalledWith("todo-1");
  });
});
