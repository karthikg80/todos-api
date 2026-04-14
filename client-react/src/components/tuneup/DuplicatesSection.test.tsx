// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { DuplicateGroup } from "../../types/tuneup";
import { DuplicatesSection } from "./DuplicatesSection";
import { dupGroupKey } from "../../utils/topFinding";

describe("DuplicatesSection", () => {
  const noop = vi.fn();

  it("shows All clear when nothing visible", () => {
    render(
      ce(DuplicatesSection, {
        groups: [],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onMerge: noop,
        onDismiss: noop,
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("hides groups that are dismissed or patched", () => {
    const group: DuplicateGroup = {
      confidence: 0.96,
      reason: "r",
      tasks: [
        { id: "t1", title: "One", status: "open", projectId: null },
        { id: "t2", title: "Two", status: "open", projectId: null },
      ],
      suggestedAction: "merge",
    };
    const key = dupGroupKey(["t1", "t2"]);
    render(
      ce(DuplicatesSection, {
        groups: [group],
        dismissed: new Set([key]),
        patchedTaskIds: new Set(),
        onMerge: noop,
        onDismiss: noop,
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("renders exact duplicate row and wires merge and dismiss", () => {
    const onMerge = vi.fn();
    const onDismiss = vi.fn();
    const group: DuplicateGroup = {
      confidence: 0.96,
      reason: "r",
      tasks: [
        { id: "t1", title: "Keep me", status: "open", projectId: null },
        { id: "t2", title: "Dup", status: "open", projectId: null },
      ],
      suggestedAction: "merge",
    };
    const key = dupGroupKey(["t1", "t2"]);
    render(
      ce(DuplicatesSection, {
        groups: [group],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onMerge,
        onDismiss,
      }),
    );
    expect(screen.getByText(/Exact:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(onMerge).toHaveBeenCalledWith(group);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith(key);
  });

  it("labels near-duplicate groups as Similar", () => {
    const group: DuplicateGroup = {
      confidence: 0.5,
      reason: "r",
      tasks: [
        { id: "a", title: "A", status: "open", projectId: null },
        { id: "b", title: "B", status: "open", projectId: null },
      ],
      suggestedAction: "review",
    };
    render(
      ce(DuplicatesSection, {
        groups: [group],
        dismissed: new Set(),
        patchedTaskIds: new Set(),
        onMerge: noop,
        onDismiss: noop,
      }),
    );
    expect(screen.getByText(/Similar:/)).toBeTruthy();
  });
});
