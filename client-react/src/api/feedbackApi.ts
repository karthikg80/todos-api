import { apiCall } from "./client";

export type FeedbackType = "bug" | "feature" | "general";
export type FeedbackStatus = "new" | "triaged" | "promoted" | "rejected" | "resolved";

export interface CreateFeedbackPayload {
  type: FeedbackType;
  title: string;
  body: string;
  screenshotUrl?: string | null;
  attachmentMetadata?: {
    name: string | null;
    type: string | null;
    size: number | null;
    lastModified: number | null;
  } | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
}

export interface FeedbackItem {
  id: string;
  userId: string;
  type: FeedbackType;
  title: string;
  body: string;
  screenshotUrl: string | null;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  status: FeedbackStatus;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserFeedbackListItem {
  id: string;
  type: FeedbackType;
  title: string;
  status: FeedbackStatus;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function submitFeedback(
  payload: CreateFeedbackPayload,
): Promise<FeedbackItem> {
  const res = await apiCall("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Submission failed" }));
    throw new Error(err.error ?? "Submission failed");
  }
  return res.json();
}

export async function fetchUserFeedback(): Promise<UserFeedbackListItem[]> {
  const res = await apiCall("/api/feedback");
  if (!res.ok) throw new Error("Failed to fetch feedback");
  return res.json();
}
