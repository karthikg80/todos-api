// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, createElement } from "@testing-library/react";
import React from "react";
import { QuickCapture } from "./QuickCapture";

const { createElement: ce } = React;

const defaultProps = {
  open: true,
  projects: [
    { id: "p1", name: "Work", status: "active" as const, archived: false },
    { id: "p2", name: "Personal", status: "active" as const, archived: false },
    { id: "p3", name: "Archived", status: "archived" as const, archived: true },
  ],
  onClose: vi.fn(),
  onCreateTask: vi.fn().mockResolvedValue(undefined),
  onCreateProject: vi.fn().mockResolvedValue(undefined),
};

describe("QuickCapture", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(ce(QuickCapture, { ...defaultProps, open: false }));
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when open is true", () => {
    render(ce(QuickCapture, defaultProps));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Quick capture");
  });

  it("shows Task tab as active by default", () => {
    render(ce(QuickCapture, defaultProps));
    expect(screen.getByText("Task")).toBeTruthy();
    const taskTab = screen.getByText("Task").closest("button");
    expect(taskTab).toHaveClass("m-capture__tab--active");
  });

  it("switches to Project mode", () => {
    render(ce(QuickCapture, defaultProps));
    fireEvent.click(screen.getByText("Project"));
    const projectTab = screen.getByText("Project").closest("button");
    expect(projectTab).toHaveClass("m-capture__tab--active");
  });

  it("shows task input placeholder", () => {
    render(ce(QuickCapture, defaultProps));
    const input = screen.getByPlaceholderText("What needs to be done?");
    expect(input).toBeTruthy();
  });

  it("shows project input placeholder in project mode", () => {
    render(ce(QuickCapture, defaultProps));
    fireEvent.click(screen.getByText("Project"));
    const input = screen.getByPlaceholderText("Project name");
    expect(input).toBeTruthy();
  });

  it("shows chips in task mode", () => {
    const { container } = render(ce(QuickCapture, defaultProps));
    const chips = container.querySelector(".m-capture__chips");
    expect(chips).toBeTruthy();
    // The chip buttons should contain text like "Project", "Priority", "Due date"
    expect(screen.getByText("▤ Project")).toBeTruthy();
    expect(screen.getByText("● Priority")).toBeTruthy();
    expect(screen.getByText("◷ Due date")).toBeTruthy();
  });

  it("cycles priority on click", () => {
    render(ce(QuickCapture, defaultProps));
    const priorityBtn = screen.getByText("● Priority").closest("button");

    fireEvent.click(priorityBtn!);
    expect(screen.getByText("● low")).toBeTruthy();

    fireEvent.click(screen.getByText("● low").closest("button")!);
    expect(screen.getByText("● medium")).toBeTruthy();
  });

  it("disables submit when title is empty", () => {
    render(ce(QuickCapture, defaultProps));
    const submit = screen.getByRole("button", { name: "Add Task" });
    expect(submit).toBeDisabled();
  });

  it("enables submit when title has content", () => {
    render(ce(QuickCapture, defaultProps));
    const input = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(input, { target: { value: "Test task" } });

    const submit = screen.getByRole("button", { name: "Add Task" });
    expect(submit).not.toBeDisabled();
  });

  it("creates a task on submit", async () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(ce(QuickCapture, { ...defaultProps, onCreateTask, onClose }));

    const input = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(input, { target: { value: "Test task" } });

    const submit = screen.getByRole("button", { name: "Add Task" });
    fireEvent.click(submit);

    await vi.waitFor(() => {
      expect(onCreateTask).toHaveBeenCalledWith({ title: "Test task" });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("creates a project on submit in project mode", async () => {
    const onCreateProject = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(ce(QuickCapture, { ...defaultProps, onCreateProject, onClose }));

    fireEvent.click(screen.getByText("Project"));
    const input = screen.getByPlaceholderText("Project name");
    fireEvent.change(input, { target: { value: "My Project" } });

    const submit = screen.getByRole("button", { name: "Add Project" });
    fireEvent.click(submit);

    await vi.waitFor(() => {
      expect(onCreateProject).toHaveBeenCalledWith("My Project");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("submits on Enter key", async () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(ce(QuickCapture, { ...defaultProps, onCreateTask, onClose }));

    const input = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(input, { target: { value: "Test task" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await vi.waitFor(() => {
      expect(onCreateTask).toHaveBeenCalled();
    });
  });

  it("closes on backdrop click", () => {
    const onClose = vi.fn();
    const { container } = render(ce(QuickCapture, { ...defaultProps, onClose }));

    const backdrop = container.querySelector(".m-capture__backdrop");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it("resets state when reopening", () => {
    const { rerender } = render(ce(QuickCapture, { ...defaultProps, open: false }));

    // Open the capture
    rerender(ce(QuickCapture, defaultProps));
    const input = screen.getByPlaceholderText("What needs to be done?");
    fireEvent.change(input, { target: { value: "Test" } });

    // Close and reopen
    rerender(ce(QuickCapture, { ...defaultProps, open: false }));
    rerender(ce(QuickCapture, defaultProps));

    // Input should be cleared
    const newInput = screen.getByPlaceholderText("What needs to be done?");
    expect((newInput as HTMLInputElement).value).toBe("");
  });
});
