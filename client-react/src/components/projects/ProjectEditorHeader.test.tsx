// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { Project } from "../../types";
import { ProjectEditorHeader } from "./ProjectEditorHeader";
import type { ProjectEditorStats } from "./projectEditorModels";

vi.mock("./ProjectKebabMenu", () => ({
  ProjectKebabMenu: ({
    onRename,
    onArchive,
    onDelete,
  }: {
    onRename: () => void;
    onArchive: () => void;
    onDelete: () => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "project-kebab" },
      React.createElement("button", { type: "button", onClick: onRename }, "Rename"),
      React.createElement("button", { type: "button", onClick: onArchive }, "Archive"),
      React.createElement("button", { type: "button", onClick: onDelete }, "Delete"),
    ),
}));

const baseProject: Project = {
  id: "p1",
  name: "Alpha",
  status: "active",
  archived: false,
  userId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const baseStats: ProjectEditorStats = {
  openCount: 2,
  completedCount: 1,
  nextStepTitle: "Ship",
  progressLabel: "50%",
  progressPercent: 50,
};

describe("ProjectEditorHeader", () => {
  it("renders stats and forwards name and description edits", () => {
    const onNameChange = vi.fn();
    const onDescriptionChange = vi.fn();
    render(
      ce(ProjectEditorHeader, {
        project: baseProject,
        name: "Alpha",
        onNameChange,
        description: "Desc",
        onDescriptionChange,
        stats: baseStats,
        onRenameMenu: vi.fn(),
        onArchiveProject: vi.fn(),
        onDeleteProject: vi.fn(),
      }),
    );
    expect(screen.getByDisplayValue("Alpha")).toBeTruthy();
    expect(screen.getByDisplayValue("Desc")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Ship")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Beta" },
    });
    expect(onNameChange).toHaveBeenCalledWith("Beta");
    fireEvent.change(screen.getByPlaceholderText(/What this project is for/i), {
      target: { value: "Next" },
    });
    expect(onDescriptionChange).toHaveBeenCalledWith("Next");
  });

  it("shows area pill when project has trimmed area", () => {
    render(
      ce(ProjectEditorHeader, {
        project: { ...baseProject, area: "  Work  " },
        name: "N",
        onNameChange: vi.fn(),
        description: "",
        onDescriptionChange: vi.fn(),
        stats: baseStats,
        onRenameMenu: vi.fn(),
        onArchiveProject: vi.fn(),
        onDeleteProject: vi.fn(),
      }),
    );
    expect(screen.getByText("Work")).toBeTruthy();
  });

  it("omits area pill when area is blank", () => {
    render(
      ce(ProjectEditorHeader, {
        project: { ...baseProject, area: "   " },
        name: "N",
        onNameChange: vi.fn(),
        description: "",
        onDescriptionChange: vi.fn(),
        stats: baseStats,
        onRenameMenu: vi.fn(),
        onArchiveProject: vi.fn(),
        onDeleteProject: vi.fn(),
      }),
    );
    expect(screen.queryByText("Work")).toBeNull();
  });

  it("forwards kebab actions", () => {
    const onRenameMenu = vi.fn();
    const onArchiveProject = vi.fn();
    const onDeleteProject = vi.fn();
    render(
      ce(ProjectEditorHeader, {
        project: baseProject,
        name: "N",
        onNameChange: vi.fn(),
        description: "",
        onDescriptionChange: vi.fn(),
        stats: baseStats,
        onRenameMenu,
        onArchiveProject,
        onDeleteProject,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(onRenameMenu).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchiveProject).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteProject).toHaveBeenCalled();
  });
});
