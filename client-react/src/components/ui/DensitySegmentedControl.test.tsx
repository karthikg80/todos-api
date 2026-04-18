// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DensitySegmentedControl } from "./DensitySegmentedControl";

describe("DensitySegmentedControl", () => {
  it("renders all three density options", () => {
    render(<DensitySegmentedControl value="normal" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "Compact" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Default" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Spacious" })).toBeInTheDocument();
  });

  it("invokes onChange with the clicked density", () => {
    const onChange = vi.fn();
    render(<DensitySegmentedControl value="normal" onChange={onChange} />);
    fireEvent.click(screen.getByRole("tab", { name: "Compact" }));
    expect(onChange).toHaveBeenCalledWith("compact");
    fireEvent.click(screen.getByRole("tab", { name: "Spacious" }));
    expect(onChange).toHaveBeenLastCalledWith("spacious");
  });
});
