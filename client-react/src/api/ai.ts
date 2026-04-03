import { apiCall } from "./client";

export async function critiqueTask(
  todoId: string,
  title: string,
): Promise<{ suggestions: string[] }> {
  const res = await apiCall("/ai/task-critic", {
    method: "POST",
    body: JSON.stringify({ todoId, title }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Daily AI quota exceeded");
    throw new Error("Failed to critique task");
  }
  return res.json();
}

export async function breakdownTask(
  todoId: string,
): Promise<{ subtasks: Array<{ title: string }> }> {
  const res = await apiCall(`/ai/todos/${todoId}/breakdown`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Daily AI quota exceeded");
    throw new Error("Failed to break down task");
  }
  return res.json();
}

// --- Priorities brief ---

export interface PrioritiesBrief {
  html: string;
  generatedAt: string;
  expiresAt?: string | null;
  cached: boolean;
  isStale?: boolean;
  refreshInFlight?: boolean;
}

export async function fetchPrioritiesBrief(): Promise<PrioritiesBrief | null> {
  const res = await apiCall("/ai/priorities-brief");
  if (!res.ok) return null;
  return res.json();
}

export async function refreshPrioritiesBrief(): Promise<PrioritiesBrief | null> {
  const res = await apiCall("/ai/priorities-brief/refresh", {
    method: "POST",
  });
  if (!res.ok) return null;
  return res.json();
}
