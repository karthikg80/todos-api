// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SubtaskList } from "./SubtaskList";
import * as apiClient from "../../api/client";

// Mock API client
vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
}));

describe("SubtaskList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state initially", () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    render(createElement(SubtaskList, { todoId: "todo-1" }));
    expect(screen.getByText("Loading subtasks…")).toBeTruthy();
  });

  it("loads and displays subtasks", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: false },
      { id: "s2", title: "Step 2", completed: true },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeTruthy();
      expect(screen.getByText("Step 2")).toBeTruthy();
    });
  });

  it("shows subtask count in header", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: true },
      { id: "s2", title: "Step 2", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("1/2")).toBeTruthy();
    });
  });

  it("toggles a subtask when checkbox is clicked", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeTruthy();
    });

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    // Optimistic update - should be checked immediately
    expect(checkbox).toBeChecked();
  });

  it("calls API when toggling subtask", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(apiClient.apiCall).toHaveBeenCalledWith(
        "/todos/todo-1/subtasks/s1",
        { method: "PUT", body: JSON.stringify({ completed: true }) },
      );
    });
  });

  it("calls API with correct payload when toggling", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("checkbox"));

    await waitFor(() => {
      expect(apiClient.apiCall).toHaveBeenCalledWith(
        "/todos/todo-1/subtasks/s1",
        { method: "PUT", body: JSON.stringify({ completed: true }) },
      );
    });
  });

  it("adds a new subtask when Enter is pressed", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Existing", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Existing")).toBeTruthy();
    });

    const input = screen.getByPlaceholderText("Add subtask…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New subtask" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(apiClient.apiCall).toHaveBeenCalledWith(
        "/todos/todo-1/subtasks",
        { method: "POST", body: JSON.stringify({ title: "New subtask" }) },
      );
    });
  });

  it("does not add empty subtask", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Existing", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Existing")).toBeTruthy();
    });

    const input = screen.getByPlaceholderText("Add subtask…") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    // Should not have called API for empty subtask
    const postCalls = vi.mocked(apiClient.apiCall).mock.calls.filter(
      (call) => call[0]?.includes("/subtasks") && call[1]?.method === "POST",
    );
    expect(postCalls.length).toBe(0);
  });

  it("deletes a subtask when delete button is clicked", async () => {
    vi.mocked(apiClient.apiCall).mockResolvedValue(new Response(JSON.stringify([
      { id: "s1", title: "Step 1", completed: false },
    ]), { status: 200 }));

    render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: 'Delete subtask "Step 1"' }));
    expect(screen.queryByText("Step 1")).toBeNull();

    await waitFor(() => {
      expect(apiClient.apiCall).toHaveBeenCalledWith(
        "/todos/todo-1/subtasks/s1",
        { method: "DELETE" },
      );
    });
  });

  it("handles API failure when loading subtasks", async () => {
    vi.mocked(apiClient.apiCall).mockRejectedValue(new Error("Network error"));
    const { container } = render(createElement(SubtaskList, { todoId: "todo-1" }));

    await waitFor(() => {
      expect(screen.queryByText("Loading subtasks…")).toBeNull();
    });
  });
});
