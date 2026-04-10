// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { Onboarding } from "./Onboarding";

const { createElement } = React;

describe("Onboarding", () => {
  beforeEach(() => {
    localStorage.removeItem("mobile:onboardingDone");
  });

  it("renders the first step by default", () => {
    render(createElement(Onboarding));

    expect(screen.getByText("Swipe to act")).toBeTruthy();
    expect(screen.getByText(/Swipe right to complete/)).toBeTruthy();
  });

  it("shows Next button on first step", () => {
    render(createElement(Onboarding));

    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("advances to next step when Next is clicked", () => {
    render(createElement(Onboarding));

    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Quick capture")).toBeTruthy();
  });

  it("shows Get started on last step", () => {
    render(createElement(Onboarding));

    // Click through all steps
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Get started")).toBeTruthy();
  });

  it("dismisses onboarding when Get started is clicked", () => {
    const { container, rerender } = render(createElement(Onboarding));

    // Click through all steps
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Get started"));

    // Onboarding should be dismissed (renders nothing)
    rerender(createElement(Onboarding));
    expect(container.firstChild).toBeNull();
  });

  it("dismisses onboarding when Skip is clicked", () => {
    const { container, rerender } = render(createElement(Onboarding));

    fireEvent.click(screen.getByText("Skip"));

    // Onboarding should be dismissed
    rerender(createElement(Onboarding));
    expect(container.firstChild).toBeNull();
  });

  it("does not render if already dismissed", () => {
    localStorage.setItem("mobile:onboardingDone", "1");

    const { container } = render(createElement(Onboarding));
    expect(container.firstChild).toBeNull();
  });

  it("shows dot indicators for steps", () => {
    render(createElement(Onboarding));

    const dots = document.querySelectorAll(".m-onboarding__dot");
    expect(dots).toHaveLength(3); // 3 steps
  });

  it("highlights the active dot", () => {
    render(createElement(Onboarding));

    const activeDot = document.querySelector(".m-onboarding__dot--active");
    expect(activeDot).toBeTruthy();
  });
});
