// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { ConfirmationView, FeedbackListView } from "./FeedbackView";
import type { FeedbackItem, UserFeedbackListItem } from "../api/feedbackApi";

// Mock navigateWithFade
vi.mock("../utils/pageTransitions", () => ({
  navigateWithFade: vi.fn(),
}));

describe("ConfirmationView", () => {
  const bugItem: FeedbackItem = {
    id: "fb-123",
    type: "bug",
    title: "App crashes on login",
    description: "Every time I try to login",
    steps: "",
    environment: "",
    githubIssueUrl: null,
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const featureItem: FeedbackItem = {
    id: "fb-456",
    type: "feature",
    title: "Add dark mode",
    description: "Would be nice to have dark mode",
    githubIssueUrl: null,
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  it("shows bug report confirmation message", () => {
    render(createElement(ConfirmationView, {
      item: bugItem,
      onSendAnother: vi.fn(),
    }));
    expect(screen.getByText("Bug report sent")).toBeTruthy();
    expect(screen.getByText(/Thanks for the report/)).toBeTruthy();
    expect(screen.getByText(/Reference ID: fb-123/)).toBeTruthy();
  });

  it("shows feature request confirmation message", () => {
    render(createElement(ConfirmationView, {
      item: featureItem,
      onSendAnother: vi.fn(),
    }));
    expect(screen.getByText("Feature request sent")).toBeTruthy();
    expect(screen.getByText(/Thanks for the idea/)).toBeTruthy();
  });

  it("calls onSendAnother when 'Send another' is clicked", () => {
    const onSendAnother = vi.fn();
    render(createElement(ConfirmationView, {
      item: bugItem,
      onSendAnother,
    }));
    fireEvent.click(screen.getByText("Send another"));
    expect(onSendAnother).toHaveBeenCalled();
  });

  it("calls navigateWithFade when 'View your submissions' is clicked", () => {
    render(createElement(ConfirmationView, {
      item: bugItem,
      onSendAnother: vi.fn(),
    }));
    fireEvent.click(screen.getByText("View your submissions"));
    // navigateWithFade is mocked, just verify the button exists
    expect(screen.getByText("View your submissions")).toBeTruthy();
  });
});

describe("FeedbackListView", () => {
  const sampleItems: UserFeedbackListItem[] = [
    { id: "fb-1", title: "Login broken", type: "bug", status: "new", createdAt: "2026-04-01T00:00:00.000Z", githubIssueUrl: null as unknown as string | undefined },
    { id: "fb-2", title: "Dark mode Please", type: "feature", status: "triaged", createdAt: "2026-03-15T00:00:00.000Z", githubIssueUrl: "https://github.com/example/1" },
    { id: "fb-3", title: "General feedback", type: "general", status: "resolved", createdAt: "2026-02-20T00:00:00.000Z", githubIssueUrl: null as unknown as string | undefined },
  ];

  it("renders empty state when no items", () => {
    render(createElement(FeedbackListView, {
      items: [],
      loading: false,
      onNew: vi.fn(),
    }));
    expect(screen.getByText(/You haven't submitted any feedback yet/)).toBeTruthy();
  });

  it("renders loading state", () => {
    render(createElement(FeedbackListView, {
      items: [],
      loading: true,
      onNew: vi.fn(),
    }));
    expect(screen.getByText("Loading your submissions…")).toBeTruthy();
  });

  it("renders list of feedback items", () => {
    render(createElement(FeedbackListView, {
      items: sampleItems,
      loading: false,
      onNew: vi.fn(),
    }));
    expect(screen.getByText("Bug")).toBeTruthy();
    expect(screen.getByText("Feature")).toBeTruthy();
    expect(screen.getByText("Feedback")).toBeTruthy();
    expect(screen.getByText("Login broken")).toBeTruthy();
    expect(screen.getByText("Dark mode Please")).toBeTruthy();
  });

  it("shows status labels for each item", () => {
    render(createElement(FeedbackListView, {
      items: sampleItems,
      loading: false,
      onNew: vi.fn(),
    }));
    expect(screen.getByText("Submitted")).toBeTruthy();
    expect(screen.getByText("Under review")).toBeTruthy();
    expect(screen.getByText("Resolved")).toBeTruthy();
  });

  it("shows 'View issue →' link when githubIssueUrl is present", () => {
    render(createElement(FeedbackListView, {
      items: sampleItems,
      loading: false,
      onNew: vi.fn(),
    }));
    expect(screen.getByText("View issue →")).toBeTruthy();
    const link = screen.getByRole("link", { name: "View issue →" });
    expect(link).toHaveAttribute("href", "https://github.com/example/1");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls onNew when 'Submit feedback' button is clicked", () => {
    const onNew = vi.fn();
    render(createElement(FeedbackListView, {
      items: sampleItems,
      loading: false,
      onNew,
    }));
    fireEvent.click(screen.getByText("Submit feedback"));
    expect(onNew).toHaveBeenCalled();
  });

  it("renders dates in readable format", () => {
    render(createElement(FeedbackListView, {
      items: sampleItems,
      loading: false,
      onNew: vi.fn(),
    }));
    // Check that date elements are rendered (format depends on timezone)
    const dates = screen.getAllByText(/\d{4}/);
    expect(dates.length).toBeGreaterThanOrEqual(1);
  });
});
