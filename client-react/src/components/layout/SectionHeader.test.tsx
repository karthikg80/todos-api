// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("toggles collapse and shows count badge when idle", () => {
    const onToggle = vi.fn();
    render(
      ce(SectionHeader, {
        title: "Stale",
        count: 3,
        collapsed: true,
        onToggle,
      }),
    );
    const btn = screen.getByRole("button", { name: /Stale/i });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalled();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("shows expanded chevron when not collapsed", () => {
    render(
      ce(SectionHeader, {
        title: "Quality",
        count: 0,
        collapsed: false,
        onToggle: vi.fn(),
      }),
    );
    expect(
      screen
        .getByRole("button", { name: /Quality/i })
        .getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("hides count badge while loading", () => {
    render(
      ce(SectionHeader, {
        title: "Taxonomy",
        count: 9,
        collapsed: false,
        onToggle: vi.fn(),
        loading: true,
      }),
    );
    expect(screen.queryByText("9")).toBeNull();
  });

  it("shows retry when error and onRetry provided", () => {
    const onRetry = vi.fn();
    render(
      ce(SectionHeader, {
        title: "Duplicates",
        count: 1,
        collapsed: false,
        onToggle: vi.fn(),
        error: "boom",
        onRetry,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Retry loading Duplicates/i }),
    );
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders as a static heading (no toggle button) when onToggle is omitted", () => {
    render(ce(SectionHeader, { title: "Profile" }));
    expect(screen.queryByRole("button", { name: /Profile/i })).toBeNull();
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("renders the title and count without a toggle in static mode", () => {
    render(ce(SectionHeader, { title: "Inbox", count: 5 }));
    expect(screen.getByText("Inbox")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });
});
