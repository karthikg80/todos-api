// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { AgentActivityView } from "./AgentActivityView";

vi.mock("../home/AgentActivityFeed", () => ({
  AgentActivityFeed: ({ standalone }: { standalone?: boolean }) =>
    React.createElement(
      "div",
      { "data-testid": "agent-activity-feed", "data-standalone": String(!!standalone) },
      "feed",
    ),
}));

describe("AgentActivityView", () => {
  it("renders title and passes standalone to feed", () => {
    const onBack = vi.fn();
    render(ce(AgentActivityView, { onBack }));
    expect(screen.getByText("Agent Activity")).toBeTruthy();
    const feed = screen.getByTestId("agent-activity-feed");
    expect(feed.getAttribute("data-standalone")).toBe("true");
  });

  it("invokes onBack when back button clicked", () => {
    const onBack = vi.fn();
    render(ce(AgentActivityView, { onBack }));
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});
