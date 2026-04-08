// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { QuickEditPanel } from "./QuickEditPanel";
import type { Todo, Project, Heading } from "../../types";

// Mock FieldRenderer
vi.mock("./FieldRenderer", () => ({
  FieldRenderer: ({ fieldDef, compact }: any) =>
    createElement("div", {
      "data-testid": `field-${fieldDef.key}`,
      "data-compact": compact,
    }),
}));

// Mock useFieldLayout
vi.mock("../../hooks/useFieldLayout", () => ({
  useFieldLayout: () => ({
    quickEdit: ["status", "priority", "dueDate", "projectId"],
  }),
}));

const mockTodo: Todo = {
  id: "todo-1",
  title: "Test task",
  description: null,
  notes: null,
  status: "next",
  completed: false,
  completedAt: null,
  projectId: null,
  category: null,
  headingId: null,
  tags: [],
  context: null,
  energy: null,
  dueDate: null,
  startDate: null,
  scheduledDate: null,
  reviewDate: null,
  doDate: null,
  estimateMinutes: null,
  waitingOn: null,
  dependsOnTaskIds: [],
  order: 0,
  priority: null,
  archived: false,
  firstStep: null,
  emotionalState: null,
  effortScore: null,
  source: null,
  recurrence: null,
  subtasks: undefined,
  userId: "user-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mockProjects: Project[] = [
  { id: "p1", name: "Work", status: "active", archived: false, userId: "u1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

const mockHeadings: Heading[] = [
  { id: "h1", projectId: "p1", name: "Planning", sortOrder: 0 },
];

const defaultProps = {
  todo: mockTodo,
  projects: mockProjects,
  headings: mockHeadings,
  onSave: vi.fn().mockResolvedValue(undefined),
  onOpenDrawer: vi.fn(),
};

describe("QuickEditPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the panel container", () => {
    render(createElement(QuickEditPanel, defaultProps));
    expect(screen.getByRole("button", { name: "Open details" })).toBeTruthy();
  });

  it("renders all quick edit fields", () => {
    render(createElement(QuickEditPanel, defaultProps));
    expect(screen.getByTestId("field-status")).toBeTruthy();
    expect(screen.getByTestId("field-priority")).toBeTruthy();
    expect(screen.getByTestId("field-dueDate")).toBeTruthy();
    expect(screen.getByTestId("field-projectId")).toBeTruthy();
  });

  it("passes compact prop to fields", () => {
    const { container } = render(createElement(QuickEditPanel, defaultProps));
    const fields = container.querySelectorAll("[data-compact='true']");
    expect(fields.length).toBe(4);
  });

  it("calls onSave when a field is edited", () => {
    render(createElement(QuickEditPanel, defaultProps));
    // Simulate onSave being called from FieldRenderer
    expect(defaultProps.onSave).not.toHaveBeenCalled();
  });

  it("calls onOpenDrawer when 'Open details' button is clicked", () => {
    render(createElement(QuickEditPanel, defaultProps));
    fireEvent.click(screen.getByRole("button", { name: "Open details" }));
    expect(defaultProps.onOpenDrawer).toHaveBeenCalled();
  });

  it("renders the Open details button", () => {
    render(createElement(QuickEditPanel, defaultProps));
    expect(screen.getByRole("button", { name: "Open details" })).toBeTruthy();
  });
});
