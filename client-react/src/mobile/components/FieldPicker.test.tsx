// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FieldPicker } from "./FieldPicker";

describe("FieldPicker", () => {
  const options = [
    { key: "a" as const, label: "Alpha", color: "#f00" },
    { key: "b" as const, label: "Beta" },
  ];

  it("toggles panel and selects an option", () => {
    const onChange = vi.fn();
    render(
      ce(FieldPicker, {
        label: "Status",
        value: null,
        options,
        onChange,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Status/i }));
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Beta/i }));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("shows selected label and active styling", () => {
    const onChange = vi.fn();
    render(
      ce(FieldPicker, {
        label: "Field",
        value: "a",
        options,
        onChange,
      }),
    );
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Field/i }));
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("clears when allowClear and Clear clicked", () => {
    const onChange = vi.fn();
    render(
      ce(FieldPicker, {
        label: "X",
        value: "a",
        options,
        onChange,
        allowClear: true,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /X/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
