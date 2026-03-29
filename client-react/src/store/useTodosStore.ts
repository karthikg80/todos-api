import { useState, useCallback, useRef } from "react";
import type { Todo, CreateTodoDto, UpdateTodoDto } from "../types";
import * as todosApi from "../api/todos";

export type LoadState = "idle" | "loading" | "loaded" | "error";

export function useTodosStore() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const loadSeqRef = useRef(0);

  const loadTodos = useCallback(
    async (params: Record<string, string | undefined> = {}) => {
      const seq = ++loadSeqRef.current;
      setLoadState("loading");
      setErrorMessage("");
      try {
        const data = await todosApi.fetchTodos(params);
        if (seq !== loadSeqRef.current) return; // stale
        setTodos(data);
        setLoadState("loaded");
      } catch (err) {
        if (seq !== loadSeqRef.current) return;
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load todos",
        );
        setLoadState("error");
      }
    },
    [],
  );

  const addTodo = useCallback(async (dto: CreateTodoDto) => {
    const created = await todosApi.createTodo(dto);
    setTodos((prev) => [created, ...prev]);
    return created;
  }, []);

  const toggleTodo = useCallback(async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t)),
    );
    try {
      const updated = await todosApi.updateTodo(id, { completed });
      setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      // Revert on failure
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)),
      );
    }
  }, []);

  const editTodo = useCallback(async (id: string, dto: UpdateTodoDto) => {
    const updated = await todosApi.updateTodo(id, dto);
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
    return updated;
  }, []);

  const removeTodo = useCallback(async (id: string) => {
    const prev = todos;
    setTodos((t) => t.filter((todo) => todo.id !== id));
    try {
      await todosApi.deleteTodo(id);
    } catch {
      setTodos(prev);
    }
  }, [todos]);

  return {
    todos,
    loadState,
    errorMessage,
    loadTodos,
    addTodo,
    toggleTodo,
    editTodo,
    removeTodo,
  };
}
