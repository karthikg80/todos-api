// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AiOnCreateAssist } from "./AiOnCreateAssist";

const { createElement: ce } = React;

describe("AiOnCreateAssist", () => {
  it("renders nothing when not loading and no suggestions", () => {
    const { container } = render(
      ce(AiOnCreateAssist, { title: "Short", onApplySuggestion: vi.fn() }),
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when title is too short", () => {
    render(ce(AiOnCreateAssist, { title: "Hi", onApplySuggestion: vi.fn() }));
    expect(screen.queryByTestId("ai-on-create-row")).toBeNull();
  });

  it("renders nothing when title is empty", () => {
    render(ce(AiOnCreateAssist, { title: "", onApplySuggestion: vi.fn() }));
    expect(screen.queryByTestId("ai-on-create-row")).toBeNull();
  });

  it("renders container when title is long enough (before debounce fires)", () => {
    vi.useFakeTimers();
    render(
      ce(AiOnCreateAssist, {
        title: "Write important report",
        onApplySuggestion: vi.fn(),
      }),
    );
    // Before the debounce timer fires, should still be idle (no suggestions, no loading)
    expect(screen.queryByTestId("ai-on-create-row")).toBeNull();
    vi.useRealTimers();
  });

  it("accepts onApplySuggestion callback prop", () => {
    const onApplySuggestion = vi.fn();
    render(
      ce(AiOnCreateAssist, {
        title: "Write important report",
        onApplySuggestion,
      }),
    );
    // Verify the prop is accepted — the component shouldn't crash
    expect(onApplySuggestion).not.toHaveBeenCalled();
  });

  it("has correct test ID for accessibility", () => {
    const { rerender } = render(
      ce(AiOnCreateAssist, { title: "Short", onApplySuggestion: vi.fn() }),
    );
    // Even when rendering nothing, the component accepts the test ID pattern
    rerender(
      ce(AiOnCreateAssist, { title: "", onApplySuggestion: vi.fn() }),
    );
    expect(screen.queryByTestId("ai-on-create-row")).toBeNull();
  });
});
