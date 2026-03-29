import { apiCall, buildUrl } from "./client";
import type { Todo, CreateTodoDto, UpdateTodoDto } from "../types";

export async function fetchTodos(
  params: Record<string, string | undefined> = {},
): Promise<Todo[]> {
  const url = buildUrl("/todos", params);
  const res = await apiCall(url);
  if (!res.ok) throw new Error(`Failed to fetch todos: ${res.status}`);
  return res.json();
}

export async function createTodo(dto: CreateTodoDto): Promise<Todo> {
  const res = await apiCall("/todos", {
    method: "POST",
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Failed to create todo: ${res.status}`);
  return res.json();
}

export async function updateTodo(
  id: string,
  dto: UpdateTodoDto,
): Promise<Todo> {
  const res = await apiCall(`/todos/${id}`, {
    method: "PUT",
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Failed to update todo: ${res.status}`);
  return res.json();
}

export async function deleteTodo(id: string): Promise<void> {
  const res = await apiCall(`/todos/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete todo: ${res.status}`);
}
