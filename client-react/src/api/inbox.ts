import { apiCall } from "./client";

export interface CaptureItem {
  id: string;
  title: string;
  createdAt: string;
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
