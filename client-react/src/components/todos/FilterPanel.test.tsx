// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPanel } from "./FilterPanel";
import type { ActiveFilters } from "./FilterPanel";

describe("FilterPanel UI", () => {
  const defaultProps = {
    filters: { dateFilter: "all" as const, priority: "" as const, status: "" as const },
    onChange: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders all date filter tabs", () => {
    render(createElement(FilterPanel, defaultProps));
    expect(screen.getByText("All")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getByText("Upcoming")).toBeTruthy();
    expect(screen.getByText("Later")).toBeTruthy();
    expect(screen.getByText("Pending")).toBeTruthy();
    expect(screen.getByText("Planned")).toBeTruthy();
  });

  it("renders priority and status selects", () => {
    render(createElement(FilterPanel, defaultProps));
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByText("Status")).toBeTruthy();
    expect(screen.getAllByRole("combobox").length).toBe(2);
  });

  it("calls onChange when a date tab is clicked", () => {
    const onChange = vi.fn();
    render(createElement(FilterPanel, { ...defaultProps, onChange }));

    fireEvent.click(screen.getByText("Today"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ dateFilter: "today" }),
    );
  });

  it("calls onChange when priority is changed", () => {
    const onChange = vi.fn();
    render(createElement(FilterPanel, { ...defaultProps, onChange }));

    const selects = screen.getAllByRole("combobox");
    const prioritySelect = selects[0];
    fireEvent.change(prioritySelect, { target: { value: "high" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ priority: "high" }),
    );
  });

  it("calls onChange when status is changed", () => {
    const onChange = vi.fn();
    render(createElement(FilterPanel, { ...defaultProps, onChange }));

    const selects = screen.getAllByRole("combobox");
    const statusSelect = selects[1];
    fireEvent.change(statusSelect, { target: { value: "waiting" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waiting" }),
    );
  });

  it("shows clear all button when filters are active", () => {
    render(
      createElement(FilterPanel, {
        ...defaultProps,
        filters: { dateFilter: "today", priority: "high", status: "waiting" },
      }),
    );
    expect(screen.getByRole("button", { name: "Clear all" })).toBeTruthy();
  });

  it("does not show clear all button when no filters are active", () => {
    render(createElement(FilterPanel, defaultProps));
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
  });

  it("clears all filters when clear all is clicked", () => {
    const onChange = vi.fn();
    render(
      createElement(FilterPanel, {
        ...defaultProps,
        filters: { dateFilter: "today", priority: "high", status: "waiting" },
        onChange,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenCalledWith({
      dateFilter: "all",
      priority: "",
      status: "",
    });
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(createElement(FilterPanel, { ...defaultProps, onClose }));

    fireEvent.click(screen.getByRole("button", { name: /close|✕/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("highlights the active date tab", () => {
    render(
      createElement(FilterPanel, {
        ...defaultProps,
        filters: { dateFilter: "upcoming", priority: "", status: "" },
      }),
    );
    const activeTab = screen.getByText("Upcoming");
    expect(activeTab.closest("button")).toHaveClass("filter-panel__tab--active");
  });
});
