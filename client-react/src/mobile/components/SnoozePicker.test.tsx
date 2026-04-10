// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SnoozePicker } from "./SnoozePicker";

const { createElement } = React;

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSnooze: vi.fn(),
};

describe("SnoozePicker", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(createElement(SnoozePicker, { ...defaultProps, open: false }));
    expect(container.firstChild).toBeNull();
  });

  it("renders dialog when open is true", () => {
    render(createElement(SnoozePicker, defaultProps));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Snooze task");
    expect(screen.getByText("Snooze until…")).toBeTruthy();
  });

  it("shows Later Today option", () => {
    render(createElement(SnoozePicker, defaultProps));
    expect(screen.getByText("Later Today")).toBeTruthy();
  });

  it("shows Tomorrow option", () => {
    render(createElement(SnoozePicker, defaultProps));
    expect(screen.getByText("Tomorrow")).toBeTruthy();
  });

  it("shows Next Week option", () => {
    render(createElement(SnoozePicker, defaultProps));
    expect(screen.getByText("Next Week")).toBeTruthy();
  });

  it("shows Pick a date option", () => {
    render(createElement(SnoozePicker, defaultProps));
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });

  it("calls onSnooze when an option is clicked", () => {
    const onSnooze = vi.fn();
    render(createElement(SnoozePicker, { ...defaultProps, onSnooze }));

    fireEvent.click(screen.getByText("Later Today").closest("button")!);
    expect(onSnooze).toHaveBeenCalledTimes(1);
    // Should receive an ISO date string
    expect(onSnooze).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(createElement(SnoozePicker, { ...defaultProps, onClose }));

    const backdrop = container.querySelector(".m-snooze__backdrop");
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows date input when Pick a date is clicked once", () => {
    const { container } = render(createElement(SnoozePicker, defaultProps));
    fireEvent.click(screen.getByText("Pick a date").closest("button")!);

    // The date input should now exist in the DOM
    const dateInput = container.querySelector('input[type="date"]');
    expect(dateInput).toBeTruthy();
  });

  it("resets state when backdrop is clicked after opening date picker", () => {
    const onClose = vi.fn();
    const { container, rerender } = render(createElement(SnoozePicker, { ...defaultProps, onClose }));

    // Open date picker
    fireEvent.click(screen.getByText("Pick a date").closest("button")!);
    // Close via backdrop
    const backdrop = container.querySelector(".m-snooze__backdrop");
    fireEvent.click(backdrop!);

    // Re-render to confirm state is reset
    rerender(createElement(SnoozePicker, { ...defaultProps, onClose }));
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });
});
