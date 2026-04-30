// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as ce } from "react";
import {
  BannerOverflowMenu,
  type SuppressedBanner,
} from "./BannerOverflowMenu";

const tagItem: SuppressedBanner = {
  id: "tag",
  label: "Filtered by tag: #work",
  actionLabel: "Clear",
  onAction: vi.fn(),
};

const coachingItem: SuppressedBanner = {
  id: "coaching",
  label: "3 tasks rolled over.",
};

describe("BannerOverflowMenu", () => {
  it("renders nothing when suppressed list is empty", () => {
    const { container } = render(ce(BannerOverflowMenu, { suppressed: [] }));
    expect(container.firstChild).toBeNull();
  });

  it("shows a trigger button with the count", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    expect(
      screen.getByRole("button", { name: /1 suppressed banner/i }),
    ).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
  });

  it("shows +N for multiple suppressed banners", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem, coachingItem] }));
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("panel is hidden by default", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens panel when trigger is clicked", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    fireEvent.click(screen.getByRole("button", { name: /suppressed/i }));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("Filtered by tag: #work")).toBeTruthy();
  });

  it("closes panel when trigger is clicked again", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    const trigger = screen.getByRole("button", { name: /suppressed/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows action button for items that have onAction", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    fireEvent.click(screen.getByRole("button", { name: /suppressed/i }));
    expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
  });

  it("does not show action button for items without onAction", () => {
    render(ce(BannerOverflowMenu, { suppressed: [coachingItem] }));
    fireEvent.click(screen.getByRole("button", { name: /suppressed/i }));
    expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
  });

  it("calls onAction and closes the panel when action is clicked", () => {
    const onAction = vi.fn();
    const item = { ...tagItem, onAction };
    render(ce(BannerOverflowMenu, { suppressed: [item] }));
    fireEvent.click(screen.getByRole("button", { name: /suppressed/i }));
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes panel on Escape key", () => {
    render(ce(BannerOverflowMenu, { suppressed: [tagItem] }));
    fireEvent.click(screen.getByRole("button", { name: /suppressed/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
