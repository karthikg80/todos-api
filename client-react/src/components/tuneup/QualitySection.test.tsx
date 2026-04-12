// @vitest-environment jsdom
// @ts-nocheck — complex mocked props cause createElement overload issues
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { QualitySection } from "./QualitySection";
import type { QualityIssue } from "../../types/tuneup";

const { createElement: ce } = React;

function makeIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    id: overrides.id ?? "q1",
    title: overrides.title ?? "Test issue",
    issues: overrides.issues ?? ["short"],
    suggestions: overrides.suggestions ?? [],
  };
}

describe("QualitySection", () => {
  it("shows All clear when no visible issues", () => {
    render(
      ce(QualitySection, {
        issues: [],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("shows All clear when all issues are dismissed", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1" })],
        dismissed: new Set(["quality:q1"]),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("shows All clear when all issues are patched", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(["q1"]),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("renders visible issues", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", title: "Issue 1" }), makeIssue({ id: "q2", title: "Issue 2" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("Issue 1")).toBeTruthy();
    expect(screen.getByText("Issue 2")).toBeTruthy();
  });

  it("renders issue tags", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", issues: ["short", "vague"] })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("short")).toBeTruthy();
    expect(screen.getByText("vague")).toBeTruthy();
  });

  it("renders first suggestion", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", suggestions: ["First suggestion", "Second"] })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    expect(screen.getByText("First suggestion")).toBeTruthy();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss,
      }),
    );
    const dismissBtns = screen.getAllByRole("button", { name: "Dismiss" });
    fireEvent.click(dismissBtns[0]);
    expect(onDismiss).toHaveBeenCalledWith("quality:q1");
  });

  it("enters edit mode when Edit button is clicked", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", title: "Original" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByDisplayValue("Original");
    expect(input).toBeTruthy();
  });

  it("calls onEditTitle when edit is committed via Enter", () => {
    const onEditTitle = vi.fn();
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", title: "Original" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle,
        onDismiss: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEditTitle).toHaveBeenCalledWith("q1", "Updated");
  });

  it("resets draft on Escape", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", title: "Original" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "Updated" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.getByText("Original")).toBeTruthy();
    expect(screen.queryByDisplayValue("Updated")).toBeNull();
  });

  it("cancels edit on blur with empty value", () => {
    render(
      ce(QualitySection, {
        issues: [makeIssue({ id: "q1", title: "Original" })],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onEditTitle: vi.fn(),
        onDismiss: vi.fn(),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = screen.getByDisplayValue("Original");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(screen.getByText("Original")).toBeTruthy();
  });
});
