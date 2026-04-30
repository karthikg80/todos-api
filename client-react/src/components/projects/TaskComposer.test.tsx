// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as ce } from "react";
import { TaskComposer } from "./TaskComposer";

const baseProps = {
  open: false,
  value: "",
  onChange: vi.fn(),
  onAdd: vi.fn(),
  onOpen: vi.fn(),
  onCancel: vi.fn(),
};

describe("TaskComposer", () => {
  it("shows the Add task trigger when closed", () => {
    render(ce(TaskComposer, baseProps));
    expect(screen.getByRole("button", { name: /add task/i })).toBeTruthy();
  });

  it("calls onOpen when the trigger button is clicked", () => {
    const onOpen = vi.fn();
    render(ce(TaskComposer, { ...baseProps, onOpen }));
    fireEvent.click(screen.getByRole("button", { name: /add task/i }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("shows the form when open", () => {
    render(ce(TaskComposer, { ...baseProps, open: true, value: "" }));
    expect(screen.getByPlaceholderText("Type a task")).toBeTruthy();
    expect(screen.getByRole("button", { name: /add task/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
  });

  it("calls onChange when the input changes", () => {
    const onChange = vi.fn();
    render(ce(TaskComposer, { ...baseProps, open: true, value: "", onChange }));
    fireEvent.change(screen.getByPlaceholderText("Type a task"), {
      target: { value: "buy milk" },
    });
    expect(onChange).toHaveBeenCalledWith("buy milk");
  });

  it("calls onAdd when Enter is pressed", () => {
    const onAdd = vi.fn();
    render(
      ce(TaskComposer, { ...baseProps, open: true, value: "buy milk", onAdd }),
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Type a task"), {
      key: "Enter",
    });
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("calls onCancel when Escape is pressed", () => {
    const onCancel = vi.fn();
    render(
      ce(TaskComposer, {
        ...baseProps,
        open: true,
        value: "buy milk",
        onCancel,
      }),
    );
    fireEvent.keyDown(screen.getByPlaceholderText("Type a task"), {
      key: "Escape",
    });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("disables Add task button when value is blank", () => {
    render(ce(TaskComposer, { ...baseProps, open: true, value: "   " }));
    const btn = screen.getByRole("button", { name: /add task/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
