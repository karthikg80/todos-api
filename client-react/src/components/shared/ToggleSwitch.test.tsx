// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToggleSwitch } from "./ToggleSwitch";

describe("ToggleSwitch", () => {
  it("renders label and unchecked switch", () => {
    render(createElement(ToggleSwitch, {
      checked: false,
      label: "Enable notifications",
      onChange: vi.fn(),
    }));
    expect(screen.getByText("Enable notifications")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Enable notifications" })).toBeTruthy();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("renders checked switch", () => {
    render(createElement(ToggleSwitch, {
      checked: true,
      label: "Enable notifications",
      onChange: vi.fn(),
    }));
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with toggled value when clicked", () => {
    const onChange = vi.fn();
    render(createElement(ToggleSwitch, {
      checked: false,
      label: "Enable notifications",
      onChange,
    }));
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders description when provided", () => {
    render(createElement(ToggleSwitch, {
      checked: false,
      label: "Enable notifications",
      description: "Get push notifications for new tasks",
      onChange: vi.fn(),
    }));
    expect(screen.getByText("Get push notifications for new tasks")).toBeTruthy();
  });

  it("applies disabled class when disabled", () => {
    const { container } = render(createElement(ToggleSwitch, {
      checked: false,
      label: "Enable notifications",
      disabled: true,
      onChange: vi.fn(),
    }));
    expect(container.querySelector(".toggle-switch--disabled")).toBeTruthy();
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("calls onChange with false when unchecking", () => {
    const onChange = vi.fn();
    render(createElement(ToggleSwitch, {
      checked: true,
      label: "Enable notifications",
      onChange,
    }));
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
