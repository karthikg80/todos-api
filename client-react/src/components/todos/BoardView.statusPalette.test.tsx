// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { BoardView } from "./BoardView";

vi.mock("../shared/Illustrations", () => ({
  IllustrationBoardEmpty: () =>
    createElement("div", { "data-testid": "empty" }),
}));

const defaultProps = {
  todos: [],
  loadState: "loaded" as const,
  onToggle: vi.fn(),
  onClick: vi.fn(),
  onStatusChange: vi.fn(),
};

describe("BoardView status palette", () => {
  it("paints each column dot with the matching status token", () => {
    const { container } = render(createElement(BoardView, defaultProps));
    const expected: Record<string, string> = {
      inbox: "var(--status-inbox)",
      next: "var(--status-next)",
      in_progress: "var(--status-in-progress)",
      waiting: "var(--status-waiting)",
      done: "var(--status-done)",
    };
    for (const [status, token] of Object.entries(expected)) {
      const column = container.querySelector(
        `.board__column[data-status="${status}"]`,
      );
      expect(column, `expected column for ${status}`).toBeTruthy();
      const dot = column!.querySelector(".board__column-dot") as HTMLElement;
      expect(dot.style.background).toContain(token);
    }
  });

  it("collapses a column body when its collapse button is clicked", () => {
    const { container } = render(createElement(BoardView, defaultProps));
    const inbox = container.querySelector(
      '.board__column[data-status="inbox"]',
    ) as HTMLElement;
    expect(inbox.querySelector(".board__column-body")).toBeTruthy();
    const button = inbox.querySelector(
      ".board__column-collapse",
    ) as HTMLButtonElement;
    fireEvent.click(button);
    expect(inbox.querySelector(".board__column-body")).toBeNull();
  });
});
