// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickEntry } from "./QuickEntry";

const assistProps = vi.hoisted(
  () =>
    ({
      latest: null as
        | {
            title: string;
            onApplySuggestion: (field: string, value: string) => void;
          }
        | null,
    }),
);

vi.mock("../ai/AiOnCreateAssist", () => ({
  AiOnCreateAssist: ({
    title,
    onApplySuggestion,
  }: {
    title: string;
    onApplySuggestion: (field: string, value: string) => void;
  }) => {
    assistProps.latest = { title, onApplySuggestion };
    return createElement(
      "div",
      { "data-testid": "mock-ai-on-create-assist" },
      createElement(
        "button",
        {
          type: "button",
          onClick: () =>
            onApplySuggestion(
              "rewrite_title",
              "Email stakeholder with deadline",
            ),
        },
        "Apply rewrite",
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: () => onApplySuggestion("dueDate", "2026-04-05"),
        },
        "Apply due date",
      ),
    );
  },
}));

vi.mock("../../hooks/useCaptureRoute", () => ({
  useCaptureRoute: () => ({
    suggestion: null,
    loading: false,
    preferredRoute: "task" as const,
    alternateRoute: "triage" as const,
  }),
}));

describe("QuickEntry", () => {
  beforeEach(() => {
    assistProps.latest = null;
  });

  afterEach(() => {
    cleanup();
  });

  it("passes the live draft title into the on-create assist surface", () => {
    render(
      createElement(QuickEntry, {
        onAddTask: vi.fn(),
        onCaptureToDesk: vi.fn(),
        placeholder: "Add a task…",
      }),
    );

    fireEvent.change(screen.getByLabelText("Add a task…"), {
      target: { value: "email follow up" },
    });

    expect(screen.getByTestId("mock-ai-on-create-assist")).toBeTruthy();
    expect(assistProps.latest?.title).toBe("email follow up");
  });

  it("applies rewrite and due-date suggestions to the inline draft", () => {
    render(
      createElement(QuickEntry, {
        onAddTask: vi.fn(),
        onCaptureToDesk: vi.fn(),
        placeholder: "Add a task…",
      }),
    );

    const input = screen.getByLabelText("Add a task…") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "email follow up" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Apply rewrite" }));
    expect(input.value).toBe("Email stakeholder with deadline");

    fireEvent.click(screen.getByRole("button", { name: "Apply due date" }));
    expect(screen.getByRole("button", { name: /apr 5/i })).toBeTruthy();
  });
});
