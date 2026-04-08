// @vitest-environment jsdom
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnimatedCount } from "./AnimatedCount";

describe("AnimatedCount", () => {
  it("renders the initial value", () => {
    render(createElement(AnimatedCount, { value: 5 }));
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("applies custom className when provided", () => {
    render(createElement(AnimatedCount, { value: 10, className: "custom-class" }));
    expect(screen.getByText("10").className).toBe("custom-class");
  });

  it("renders zero correctly", () => {
    render(createElement(AnimatedCount, { value: 0 }));
    expect(screen.getByText("0")).toBeTruthy();
  });

  it("renders negative values", () => {
    render(createElement(AnimatedCount, { value: -5 }));
    expect(screen.getByText("-5")).toBeTruthy();
  });
});
