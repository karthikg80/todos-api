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

// --- Focus suggestions ---

export interface FocusSuggestion {
  type: string;
  suggestionId: string;
  todoId: string;
  title: string;
  summary: string;
  source: string;
  confidence: number;
}

export async function fetchFocusSuggestions(
  candidates: Array<{ id: string; title: string; priority?: string | null; dueDate?: string | null }>,
): Promise<{ aiSuggestionId: string; suggestions: FocusSuggestion[] }> {
  // Try cached first
  const latestRes = await apiCall(
    "/ai/suggestions/latest?surface=home_focus",
  );
  if (latestRes.ok && latestRes.status !== 204) {
    const data = await latestRes.json();
    if (data.suggestions?.length) {
      return {
        aiSuggestionId: data.id || "",
        suggestions: data.suggestions.slice(0, 3),
      };
    }
  }

  // Generate new
  const genRes = await apiCall("/ai/decision-assist/stub", {
    method: "POST",
    body: JSON.stringify({
      surface: "home_focus",
      candidates: candidates.slice(0, 60),
    }),
  });
  if (!genRes.ok) return { aiSuggestionId: "", suggestions: [] };

  // Fetch the generated result
  const freshRes = await apiCall(
    "/ai/suggestions/latest?surface=home_focus",
  );
  if (freshRes.ok && freshRes.status !== 204) {
    const data = await freshRes.json();
    return {
      aiSuggestionId: data.id || "",
      suggestions: (data.suggestions || []).slice(0, 3),
    };
  }

  return { aiSuggestionId: "", suggestions: [] };
}

export async function applyFocusSuggestion(
  aiSuggestionId: string,
): Promise<void> {
  await apiCall(`/ai/suggestions/${aiSuggestionId}/apply`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function dismissFocusSuggestion(
  aiSuggestionId: string,
): Promise<void> {
  await apiCall(`/ai/suggestions/${aiSuggestionId}/dismiss`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// --- Priorities brief ---

export interface PrioritiesBrief {
  html: string;
  generatedAt: string;
  cached: boolean;
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
