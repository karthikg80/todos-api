// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ProfileLauncher } from "./ProfileLauncher";

const { createElement: ce } = React;

const mockUser = {
  id: "u1",
  name: "Test User",
  email: "test@example.com",
};

const defaultProps = {
  user: mockUser,
  dark: false,
  isAdmin: false,
  onOpenProfile: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenComponents: vi.fn(),
  onToggleTheme: vi.fn(),
  onOpenShortcuts: vi.fn(),
  onOpenFeedback: vi.fn(),
  onOpenAdmin: vi.fn(),
  onLogout: vi.fn(),
};

describe("ProfileLauncher", () => {
  it("renders trigger button with user initials", () => {
    render(ce(ProfileLauncher, defaultProps));
    expect(screen.getByText("TU")).toBeTruthy();
  });

  it("shows display name on trigger", () => {
    render(ce(ProfileLauncher, defaultProps));
    expect(screen.getByText("Test User")).toBeTruthy();
  });

  it("opens panel when trigger is clicked", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
  });

  it("shows menu items when open", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);

    expect(screen.getByText("Profile")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Dark mode")).toBeTruthy();
    expect(screen.getByText("Keyboard shortcuts")).toBeTruthy();
    expect(screen.getByText("Send feedback")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("shows Admin panel for admin users", () => {
    render(ce(ProfileLauncher, { ...defaultProps, isAdmin: true }));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.getByText("Admin panel")).toBeTruthy();
  });

  it("hides Admin panel for non-admin users", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.queryByText("Admin panel")).toBeNull();
  });

  it("shows Light mode when dark is true", () => {
    render(ce(ProfileLauncher, { ...defaultProps, dark: true }));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.getByText("Light mode")).toBeTruthy();
  });

  it("calls onToggleTheme when theme item is clicked", async () => {
    const onToggleTheme = vi.fn();
    render(ce(ProfileLauncher, { ...defaultProps, onToggleTheme }));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Dark mode"));
    // Action is delayed by requestAnimationFrame
    await vi.waitFor(() => expect(onToggleTheme).toHaveBeenCalled());
  });

  it("calls onLogout when sign out is clicked", async () => {
    const onLogout = vi.fn();
    render(ce(ProfileLauncher, { ...defaultProps, onLogout }));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Sign out"));
    // Action is delayed by requestAnimationFrame
    await vi.waitFor(() => expect(onLogout).toHaveBeenCalled());
  });

  it("closes panel on Escape key", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("navigates with arrow keys", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: "ArrowDown" });
    const items = document.querySelectorAll(".profile-launcher__menu-item");
    expect(items[0]).toHaveClass("profile-launcher__menu-item--active");
  });

  it("closes panel when outside is clicked", () => {
    render(ce(ProfileLauncher, defaultProps));
    const trigger = screen.getByRole("button", { name: /TU/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("handles user with no name (uses email prefix)", () => {
    render(ce(ProfileLauncher, {
      ...defaultProps,
      user: { id: "u2", name: "", email: "john@example.com" },
    }));
    expect(screen.getByText("john")).toBeTruthy();
  });

  it("shows email on trigger", () => {
    render(ce(ProfileLauncher, defaultProps));
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });
});
