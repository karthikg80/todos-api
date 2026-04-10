// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BottomSheet } from "./BottomSheet";

const { createElement } = React;

const halfContent = createElement("div", { "data-testid": "half" }, "Half Content");
const fullContent = createElement("div", { "data-testid": "full" }, "Full Content");

describe("BottomSheet", () => {
  it("renders nothing when snap is closed", () => {
    const { container } = render(
      createElement(BottomSheet, {
        snap: "closed",
        onClose: vi.fn(),
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders half content when snap is half", () => {
    render(
      createElement(BottomSheet, {
        snap: "half",
        onClose: vi.fn(),
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    expect(screen.getByTestId("half")).toBeTruthy();
    expect(screen.queryByTestId("full")).toBeNull();
  });

  it("renders full content when snap is full", () => {
    render(
      createElement(BottomSheet, {
        snap: "full",
        onClose: vi.fn(),
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    expect(screen.getByTestId("full")).toBeTruthy();
    expect(screen.queryByTestId("half")).toBeNull();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      createElement(BottomSheet, {
        snap: "half",
        onClose,
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    const backdrop = container.querySelector(".m-bottom-sheet__backdrop");
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it("has dialog role and aria-modal for accessibility", () => {
    render(
      createElement(BottomSheet, {
        snap: "half",
        onClose: vi.fn(),
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("has handle element for drag interaction", () => {
    const { container } = render(
      createElement(BottomSheet, {
        snap: "half",
        onClose: vi.fn(),
        onExpandFull: vi.fn(),
        halfContent,
        fullContent,
      })
    );
    const handle = container.querySelector(".m-bottom-sheet__handle");
    expect(handle).toBeTruthy();
  });
});
