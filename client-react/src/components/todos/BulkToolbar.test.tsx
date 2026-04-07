// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BulkToolbar } from "./BulkToolbar";

describe("BulkToolbar", () => {
  it("renders the toolbar with select all checkbox", () => {
    render(
      createElement(BulkToolbar, {
        selectedCount: 2,
        totalCount: 5,
        allSelected: false,
        onSelectAll: vi.fn(),
        onComplete: vi.fn(),
        onDelete: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(screen.getByRole("checkbox", { name: "Select all" })).toBeTruthy();
    expect(screen.getByText("2 of 5 selected")).toBeTruthy();
  });

  it("calls onSelectAll when checkbox is toggled", () => {
    const onSelectAll = vi.fn();
    render(
      createElement(BulkToolbar, {
        selectedCount: 2,
        totalCount: 5,
        allSelected: false,
        onSelectAll,
        onComplete: vi.fn(),
        onDelete: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it("calls onComplete when complete button is clicked", () => {
    const onComplete = vi.fn();
    render(
      createElement(BulkToolbar, {
        selectedCount: 2,
        totalCount: 5,
        allSelected: false,
        onSelectAll: vi.fn(),
        onComplete,
        onDelete: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Complete" }));
    expect(onComplete).toHaveBeenCalled();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      createElement(BulkToolbar, {
        selectedCount: 3,
        totalCount: 5,
        allSelected: false,
        onSelectAll: vi.fn(),
        onComplete: vi.fn(),
        onDelete,
        onCancel: vi.fn(),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      createElement(BulkToolbar, {
        selectedCount: 2,
        totalCount: 5,
        allSelected: false,
        onSelectAll: vi.fn(),
        onComplete: vi.fn(),
        onDelete: vi.fn(),
        onCancel,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows correct selection count", () => {
    render(
      createElement(BulkToolbar, {
        selectedCount: 4,
        totalCount: 10,
        allSelected: false,
        onSelectAll: vi.fn(),
        onComplete: vi.fn(),
        onDelete: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    expect(screen.getByText("4 of 10 selected")).toBeTruthy();
  });

  it("shows all selected state", () => {
    render(
      createElement(BulkToolbar, {
        selectedCount: 5,
        totalCount: 5,
        allSelected: true,
        onSelectAll: vi.fn(),
        onComplete: vi.fn(),
        onDelete: vi.fn(),
        onCancel: vi.fn(),
      }),
    );

    const checkbox = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText("5 of 5 selected")).toBeTruthy();
  });
});
