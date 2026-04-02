import { apiCall } from "./client";

export interface CaptureItem {
  id: string;
  title: string;
  createdAt: string;
}

export interface CaptureRouteSuggestion {
  route: "task" | "triage";
  confidence: number;
  why: string;
  cleanedTitle?: string;
  extractedFields?: {
    dueDate?: string | null;
    project?: string | null;
    projectId?: string | null;
  };
}

interface AgentEnvelope<T> {
  data?: T;
}

export async function fetchInboxItems(): Promise<CaptureItem[]> {
  const res = await apiCall("/agent/read/list_inbox_items", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

export async function promoteCapture(captureId: string): Promise<boolean> {
  const res = await apiCall("/agent/write/promote_inbox_item", {
    method: "POST",
    body: JSON.stringify({ captureId, type: "task" }),
  });
  return res.ok;
}

export async function discardCapture(captureId: string): Promise<boolean> {
  const res = await apiCall("/agent/write/triage_capture_item", {
    method: "POST",
    body: JSON.stringify({ captureId, mode: "apply" }),
  });
  return res.ok;
}

export async function suggestCaptureRoute(input: {
  text: string;
  project?: string | null;
  workspaceView?: string;
}): Promise<CaptureRouteSuggestion | null> {
  const res = await apiCall("/agent/read/suggest_capture_route", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!res.ok) return null;

  const payload = (await res.json()) as
    | CaptureRouteSuggestion
    | AgentEnvelope<CaptureRouteSuggestion>;
  if ("data" in payload && payload.data) {
    return payload.data;
  }
  return payload as CaptureRouteSuggestion;
}

export async function captureInboxItem(
  text: string,
  source = "app",
): Promise<boolean> {
  const res = await apiCall("/agent/write/capture_inbox_item", {
    method: "POST",
    body: JSON.stringify({ text, source }),
  });
  return res.ok;
}
