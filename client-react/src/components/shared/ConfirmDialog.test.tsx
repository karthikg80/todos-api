// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title and message", () => {
    render(createElement(ConfirmDialog, {
      title: "Delete task?",
      message: "This action cannot be undone.",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }));
    expect(screen.getByText("Delete task?")).toBeTruthy();
    expect(screen.getByText("This action cannot be undone.")).toBeTruthy();
  });

  it("renders with default confirm label 'Delete'", () => {
    render(createElement(ConfirmDialog, {
      title: "Confirm",
      message: "Are you sure?",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }));
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("renders with custom confirm label", () => {
    render(createElement(ConfirmDialog, {
      title: "Confirm",
      message: "Are you sure?",
      confirmLabel: "Archive",
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
  });

  it("calls onConfirm when OK button is clicked", () => {
    const onConfirm = vi.fn();
    render(createElement(ConfirmDialog, {
      title: "Delete task?",
      message: "This cannot be undone.",
      onConfirm,
      onCancel: vi.fn(),
    }));
    // Dialog uses animateOut which uses setTimeout
    vi.useFakeTimers();
    const okBtn = screen.getByRole("button", { name: "Delete" });
    okBtn.click();
    vi.runAllTimers();
    expect(onConfirm).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(createElement(ConfirmDialog, {
      title: "Delete task?",
      message: "This cannot be undone.",
      onConfirm: vi.fn(),
      onCancel,
    }));
    vi.useFakeTimers();
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    cancelBtn.click();
    vi.runAllTimers();
    expect(onCancel).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("calls onCancel when backdrop is clicked", () => {
    const onCancel = vi.fn();
    render(createElement(ConfirmDialog, {
      title: "Delete task?",
      message: "This cannot be undone.",
      onConfirm: vi.fn(),
      onCancel,
    }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("alertdialog").parentElement!);
    vi.runAllTimers();
    expect(onCancel).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
