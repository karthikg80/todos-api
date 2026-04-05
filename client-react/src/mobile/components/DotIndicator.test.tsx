import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DotIndicator } from "./DotIndicator";

describe("DotIndicator", () => {
  it("renders correct number of dots", () => {
    const { container } = render(<DotIndicator count={5} activeIndex={0} />);
    expect(container.querySelectorAll(".m-dot").length).toBe(5);
  });

  it("marks the active dot", () => {
    const { container } = render(<DotIndicator count={3} activeIndex={1} />);
    const dots = container.querySelectorAll(".m-dot");
    expect(dots[0].classList.contains("m-dot--active")).toBe(false);
    expect(dots[1].classList.contains("m-dot--active")).toBe(true);
    expect(dots[2].classList.contains("m-dot--active")).toBe(false);
  });

  it("renders nothing when count is 0", () => {
    const { container } = render(<DotIndicator count={0} activeIndex={0} />);
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });

  it("renders nothing when count is 1", () => {
    const { container } = render(<DotIndicator count={1} activeIndex={0} />);
    expect(container.querySelector(".m-dot-indicator")).toBeNull();
  });
});
