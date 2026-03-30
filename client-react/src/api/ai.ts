import { apiCall } from "./client";

export async function getAiUsage(): Promise<{
  used: number;
  limit: number;
  remaining: number;
}> {
  const res = await apiCall("/ai/usage");
  if (!res.ok) throw new Error("Failed to fetch AI usage");
  return res.json();
}

export async function generatePlanFromGoal(
  goal: string,
): Promise<{ id: string; suggestions: unknown[] }> {
  const res = await apiCall("/ai/plan-from-goal", {
    method: "POST",
    body: JSON.stringify({ goal }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Daily AI quota exceeded");
    throw new Error("Failed to generate plan");
  }
  return res.json();
}

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

export async function getAiSuggestions(): Promise<unknown[]> {
  const res = await apiCall("/ai/suggestions?limit=20");
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  return res.json();
}

export async function updateSuggestionStatus(
  id: string,
  status: "accepted" | "rejected",
  reason?: string,
): Promise<void> {
  const res = await apiCall(`/ai/suggestions/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, reason }),
  });
  if (!res.ok) throw new Error("Failed to update suggestion");
}
