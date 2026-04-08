// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsOverlay } from "./ShortcutsOverlay";

// Mock the useOverlayFocusTrap hook since it's complex to test
vi.mock("./useOverlayFocusTrap", () => ({
  useOverlayFocusTrap: vi.fn(),
}));

describe("ShortcutsOverlay", () => {
  it("renders nothing when not open", () => {
    render(createElement(ShortcutsOverlay, {
      isOpen: false,
      onClose: vi.fn(),
    }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders shortcuts dialog when open", () => {
    render(createElement(ShortcutsOverlay, {
      isOpen: true,
      onClose: vi.fn(),
    }));
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeTruthy();
    expect(screen.getByText("Keyboard Shortcuts")).toBeTruthy();
  });

  it("renders all shortcut rows", () => {
    render(createElement(ShortcutsOverlay, {
      isOpen: true,
      onClose: vi.fn(),
    }));
    expect(screen.getByText("⌘/Ctrl + K")).toBeTruthy();
    expect(screen.getByText("New task")).toBeTruthy();
    expect(screen.getByText("j / k")).toBeTruthy();
    expect(screen.getByText("Navigate tasks up/down")).toBeTruthy();
    expect(screen.getByText("Escape")).toBeTruthy();
    expect(screen.getByText("Close drawer / cancel")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(createElement(ShortcutsOverlay, {
      isOpen: true,
      onClose,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Close keyboard shortcuts" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(createElement(ShortcutsOverlay, {
      isOpen: true,
      onClose,
    }));
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when clicking inside dialog", () => {
    const onClose = vi.fn();
    render(createElement(ShortcutsOverlay, {
      isOpen: true,
      onClose,
    }));
    fireEvent.click(screen.getByText("Keyboard Shortcuts"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
