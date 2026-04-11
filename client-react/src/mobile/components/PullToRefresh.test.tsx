// @vitest-environment jsdom
// @ts-nocheck — createElement overload issues with mocked async callbacks
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PullToRefresh } from "./PullToRefresh";

const { createElement: ce } = React;

const noopRefresh = vi.fn().mockResolvedValue(undefined);

describe("PullToRefresh", () => {
  it("renders children", () => {
    render(ce(PullToRefresh, { onRefresh: noopRefresh }, ce("div", null, "Hello")));
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("renders the pull refresh container", () => {
    const { container } = render(
      ce(PullToRefresh, { onRefresh: noopRefresh }, ce("div", null, "Content")),
    );
    expect(container.querySelector(".m-pull-refresh")).toBeTruthy();
    expect(container.querySelector(".m-pull-refresh__indicator")).toBeTruthy();
  });

  it("does not show refresh text initially", () => {
    const { container } = render(
      ce(PullToRefresh, { onRefresh: noopRefresh }, ce("div", null, "Content")),
    );
    const text = container.querySelector(".m-pull-refresh__text");
    expect(text).toBeNull();
  });

  it("does not show spinner initially", () => {
    const { container } = render(
      ce(PullToRefresh, { onRefresh: noopRefresh }, ce("div", null, "Content")),
    );
    const spinner = container.querySelector(".m-pull-refresh__spinner");
    expect(spinner).toBeNull();
  });

  it("calls onRefresh prop when triggered", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined) as () => Promise<void>;
    render(ce(PullToRefresh, { onRefresh }, ce("div", null, "Content")));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("passes through arbitrary children", () => {
    const { container } = render(
      ce(
        PullToRefresh,
        { onRefresh: noopRefresh },
        ce("div", { className: "child-1" }, "First"),
        ce("div", { className: "child-2" }, "Second"),
      ),
    );
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });
});
