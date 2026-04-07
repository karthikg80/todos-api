import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import * as todosApi from "../api/todos";
import { useTodosStore, type LoadState } from "./useTodosStore";
import type { Todo, CreateTodoDto, UpdateTodoDto } from "../types";

vi.mock("../api/todos");

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
  subtasks: overrides.subtasks ?? null,
  userId: overrides.userId ?? "user-1",
  createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
});

describe("useTodosStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with empty todos and idle load state", () => {
      const { result } = renderHook(() => useTodosStore());
      expect(result.current.todos).toEqual([]);
      expect(result.current.loadState).toBe("idle");
      expect(result.current.errorMessage).toBe("");
    });
  });

  describe("loadTodos", () => {
    it("loads todos successfully", async () => {
      const todos = [makeTodo({ id: "1" }), makeTodo({ id: "2" })];
      vi.mocked(todosApi.fetchTodos).mockResolvedValue(todos);

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos({ projectId: "proj-1" });
      });

      expect(todosApi.fetchTodos).toHaveBeenCalledWith({ projectId: "proj-1" });
      expect(result.current.todos).toEqual(todos);
      expect(result.current.loadState).toBe("loaded");
    });

    it("sets error state on failure", async () => {
      vi.mocked(todosApi.fetchTodos).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      expect(result.current.loadState).toBe("error");
      expect(result.current.errorMessage).toBe("Network error");
    });

    it("sets generic error message for non-Error rejections", async () => {
      vi.mocked(todosApi.fetchTodos).mockRejectedValue("string error");

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      expect(result.current.errorMessage).toBe("Failed to load todos");
    });

    it("handles rapid successive loads gracefully", async () => {
      const first = [makeTodo({ id: "first" })];
      const second = [makeTodo({ id: "second" })];
      vi.mocked(todosApi.fetchTodos)
        .mockResolvedValueOnce(first)
        .mockResolvedValueOnce(second);

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });
      await act(async () => {
        await result.current.loadTodos();
      });

      // Both loads complete; the second one should have the latest data
      expect(result.current.todos).toEqual(second);
    });
  });

  describe("addTodo", () => {
    it("returns created todo and prepends it via the API", async () => {
      const created = makeTodo({ id: "new-1", title: "New task" });
      vi.mocked(todosApi.createTodo).mockResolvedValue(created);

      const { result } = renderHook(() => useTodosStore());

      let added: Todo;
      await act(async () => {
        added = await result.current.addTodo({ title: "New task" } as CreateTodoDto);
      });

      expect(todosApi.createTodo).toHaveBeenCalledWith({ title: "New task" });
      expect(added).toEqual(created);
      // The store prepends via setTodos updater, so the created todo should be in the list
      expect(result.current.todos.length).toBe(1);
      expect(result.current.todos[0].id).toBe("new-1");
    });
  });

  describe("toggleTodo", () => {
    it("calls updateTodo API with completed flag", async () => {
      const original = makeTodo({ id: "t1", completed: false });
      const updated = makeTodo({ id: "t1", completed: true });
      vi.mocked(todosApi.fetchTodos).mockResolvedValue([original]);
      vi.mocked(todosApi.updateTodo).mockResolvedValue(updated);

      const { result } = renderHook(() => useTodosStore());

      // Pre-populate via loadTodos
      await act(async () => {
        await result.current.loadTodos();
      });
      expect(result.current.todos).toEqual([original]);

      await act(async () => {
        await result.current.toggleTodo("t1", true);
      });

      expect(todosApi.updateTodo).toHaveBeenCalledWith("t1", { completed: true });
      expect(result.current.todos).toEqual([updated]);
    });

    it("reverts optimistically on server failure", async () => {
      const original = makeTodo({ id: "t1", completed: false });
      vi.mocked(todosApi.fetchTodos).mockResolvedValue([original]);
      vi.mocked(todosApi.updateTodo).mockRejectedValue(new Error("Fail"));

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      await act(async () => {
        await result.current.toggleTodo("t1", true);
      });

      // Should be reverted to original state
      expect(result.current.todos).toEqual([original]);
    });
  });

  describe("editTodo", () => {
    it("updates the todo and returns the server response", async () => {
      const original = makeTodo({ id: "t1", title: "Old title" });
      const updated = makeTodo({ id: "t1", title: "New title" });
      vi.mocked(todosApi.fetchTodos).mockResolvedValue([original]);
      vi.mocked(todosApi.updateTodo).mockResolvedValue(updated);

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      let edited: Todo;
      await act(async () => {
        edited = await result.current.editTodo("t1", { title: "New title" } as UpdateTodoDto);
      });

      expect(todosApi.updateTodo).toHaveBeenCalledWith("t1", { title: "New title" });
      expect(result.current.todos).toEqual([updated]);
      expect(edited).toEqual(updated);
    });
  });

  describe("removeTodo", () => {
    it("deletes the todo via API and removes from list", async () => {
      const t1 = makeTodo({ id: "t1" });
      const t2 = makeTodo({ id: "t2" });
      vi.mocked(todosApi.fetchTodos).mockResolvedValue([t1, t2]);
      vi.mocked(todosApi.deleteTodo).mockResolvedValue(undefined);

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      await act(async () => {
        await result.current.removeTodo("t1");
      });

      expect(todosApi.deleteTodo).toHaveBeenCalledWith("t1");
      expect(result.current.todos).toEqual([t2]);
    });

    it("restores the todo on server failure", async () => {
      const t1 = makeTodo({ id: "t1" });
      const t2 = makeTodo({ id: "t2" });
      vi.mocked(todosApi.fetchTodos).mockResolvedValue([t1, t2]);
      vi.mocked(todosApi.deleteTodo).mockRejectedValue(new Error("Fail"));

      const { result } = renderHook(() => useTodosStore());

      await act(async () => {
        await result.current.loadTodos();
      });

      await act(async () => {
        await result.current.removeTodo("t1");
      });

      expect(result.current.todos).toEqual([t1, t2]);
    });
  });
});
