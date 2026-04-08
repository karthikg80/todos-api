// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { TaskTimeline } from "./TaskTimeline";
import * as apiClient from "../../api/client";

// Mock api client
vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

// Mock relativeTime
vi.mock("../../utils/relativeTime", () => ({
  relativeTime: (date: string) => `2 days ago`,
}));

const mockEvents = [
  { id: "e1", eventType: "task_created", metadata: {}, createdAt: "2026-04-01T00:00:00.000Z" },
  { id: "e2", eventType: "task_status_changed", metadata: { statusTo: "next" }, createdAt: "2026-04-02T00:00:00.000Z" },
  { id: "e3", eventType: "task_completed", metadata: {}, createdAt: "2026-04-03T00:00:00.000Z" },
];

describe("TaskTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while loading", () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const { container } = render(createElement(TaskTimeline, { todoId: "todo-1" }));
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when no events", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const { container } = render(createElement(TaskTimeline, { todoId: "todo-1" }));
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders events when loaded", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify(mockEvents), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Activity")).toBeTruthy();
      expect(screen.getByText("Created")).toBeTruthy();
      expect(screen.getByText("Completed")).toBeTruthy();
    });
  });

  it("shows status change details", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify(mockEvents), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText(/Status changed/)).toBeTruthy();
      expect(screen.getByText(/→ next/)).toBeTruthy();
    });
  });

  it("shows relative time for each event", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify(mockEvents), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getAllByText("2 days ago").length).toBe(3);
    });
  });

  it("shows 'Show all' button when more than 5 events", async () => {
    const manyEvents = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      eventType: "task_updated",
      metadata: {},
      createdAt: "2026-04-01T00:00:00.000Z",
    }));
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify(manyEvents), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Show all/ })).toBeTruthy();
    });
  });

  it("expands to show all events when 'Show all' is clicked", async () => {
    const manyEvents = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i}`,
      eventType: "task_updated",
      metadata: {},
      createdAt: "2026-04-01T00:00:00.000Z",
    }));
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify(manyEvents), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Show all/ })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Show all (8)" }));
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("handles unknown event types gracefully", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "e1", eventType: "custom_unknown_event", metadata: {}, createdAt: "2026-04-01T00:00:00.000Z" },
    ]), { status: 200 }));
    render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("custom unknown event")).toBeTruthy();
    });
  });

  it("handles API failure gracefully", async () => {
    vi.mocked(apiClient.apiCall).mockRejectedValue(new Error("Network error"));
    const { container } = render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("handles non-array response gracefully", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify({ error: "Not found" }), { status: 200 }));
    const { container } = render(createElement(TaskTimeline, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
