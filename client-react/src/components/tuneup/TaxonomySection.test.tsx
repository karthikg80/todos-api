// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaxonomySection } from "./TaxonomySection";
import { taxSimilarKey } from "../../utils/topFinding";

describe("TaxonomySection", () => {
  const noop = vi.fn();

  it("shows All clear when no visible rows", () => {
    render(
      ce(TaxonomySection, {
        similarProjects: [],
        smallProjects: [],
        dismissed: new Set(),
        patchedProjectIds: new Set(),
        onArchiveProject: noop,
        onDismiss: noop,
      }),
    );
    expect(screen.getByText("All clear")).toBeTruthy();
  });

  it("renders similar project pair and dismiss uses stable key", () => {
    const onDismiss = vi.fn();
    const pair = {
      projectAName: "Front",
      projectBName: "Back",
      projectAId: "1",
      projectBId: "2",
    };
    const key = taxSimilarKey(
      pair.projectAId,
      pair.projectBId,
      pair.projectAName,
      pair.projectBName,
    );
    render(
      ce(TaxonomySection, {
        similarProjects: [pair],
        smallProjects: [],
        dismissed: new Set(),
        patchedProjectIds: new Set(),
        onArchiveProject: noop,
        onDismiss,
      }),
    );
    expect(screen.getByText(/look similar/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith(key);
  });

  it("renders small project with id including archive", () => {
    const onArchiveProject = vi.fn();
    const onDismiss = vi.fn();
    render(
      ce(TaxonomySection, {
        similarProjects: [],
        smallProjects: [{ name: "Tiny", id: "proj-1", taskCount: 2 }],
        dismissed: new Set(),
        patchedProjectIds: new Set(),
        onArchiveProject,
        onDismiss,
      }),
    );
    expect(screen.getByText(/"Tiny" has only 2 tasks/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchiveProject).toHaveBeenCalledWith("proj-1");
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]!);
    expect(onDismiss).toHaveBeenCalledWith("tax:low:proj-1");
  });

  it("omits archive for small project without id and uses name dismiss key", () => {
    const onDismiss = vi.fn();
    render(
      ce(TaxonomySection, {
        similarProjects: [],
        smallProjects: [{ name: "Solo", taskCount: 1 }],
        dismissed: new Set(),
        patchedProjectIds: new Set(),
        onArchiveProject: noop,
        onDismiss,
      }),
    );
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledWith("tax:low:name:Solo");
  });
});
