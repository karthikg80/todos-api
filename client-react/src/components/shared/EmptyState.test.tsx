// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the headline", () => {
    render(ce(EmptyState, { headline: "No tasks yet" }));
    expect(screen.getByText("No tasks yet")).toBeTruthy();
  });

  it("renders the supporting copy when provided", () => {
    render(
      ce(EmptyState, {
        headline: "Inbox zero",
        copy: "Capture something below to get started.",
      }),
    );
    expect(
      screen.getByText("Capture something below to get started."),
    ).toBeTruthy();
  });

  it("renders the illustration slot when provided", () => {
    render(
      ce(EmptyState, {
        headline: "Empty",
        illustration: ce("svg", { "data-testid": "art" }),
      }),
    );
    expect(screen.getByTestId("art")).toBeTruthy();
  });

  it("renders the CTA and forwards clicks", () => {
    const onClick = vi.fn();
    render(
      ce(EmptyState, {
        headline: "Add your first task",
        cta: { label: "New task", onClick },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("accepts a ReactNode CTA for custom rendering", () => {
    render(
      ce(EmptyState, {
        headline: "x",
        cta: ce("a", { href: "/help" }, "Read docs"),
      }),
    );
    expect(screen.getByRole("link", { name: "Read docs" })).toBeTruthy();
  });
});
