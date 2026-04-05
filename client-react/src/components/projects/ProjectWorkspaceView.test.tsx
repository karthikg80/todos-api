// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Heading, Project, Todo } from "../../types";
import { ProjectWorkspaceView } from "./ProjectWorkspaceView";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";

vi.mock("../../hooks/useProjectHeadings", () => ({
  useProjectHeadings: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "Project workspace",
    description: overrides.description ?? "A project for testing the overview surface.",
    status: overrides.status ?? "active",
    priority: overrides.priority ?? null,
    area: overrides.area ?? null,
    areaId: overrides.areaId ?? null,
    targetDate: overrides.targetDate ?? null,
    archived: overrides.archived ?? false,
    todoCount: overrides.todoCount,
    openTodoCount: overrides.openTodoCount,
    completedTaskCount: overrides.completedTaskCount,
    userId: overrides.userId ?? "user-1",
    createdAt: overrides.createdAt ?? "2026-04-01T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-03T09:00:00.000Z",
  };
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "todo-1",
    title: overrides.title ?? "Task",
    description: overrides.description ?? null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    projectId: overrides.projectId ?? "project-1",
    category: overrides.category ?? null,
    headingId: overrides.headingId,
    tags: overrides.tags ?? [],
    context: overrides.context ?? null,
    energy: overrides.energy ?? null,
    dueDate: overrides.dueDate ?? null,
    startDate: overrides.startDate ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    reviewDate: overrides.reviewDate ?? null,
    doDate: overrides.doDate ?? null,
    estimateMinutes: overrides.estimateMinutes ?? null,
    waitingOn: overrides.waitingOn ?? null,
    dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
    order: overrides.order ?? 0,
    priority: overrides.priority ?? null,
    archived: overrides.archived ?? false,
    firstStep: overrides.firstStep ?? null,
    emotionalState: overrides.emotionalState ?? null,
    effortScore: overrides.effortScore ?? null,
    source: overrides.source ?? null,
    recurrence: overrides.recurrence ?? null,
    subtasks: overrides.subtasks,
    userId: overrides.userId ?? "user-1",
    createdAt: overrides.createdAt ?? "2026-04-01T09:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-04-03T09:00:00.000Z",
  };
}

function makeHeading(overrides: Partial<Heading> = {}): Heading {
  return {
    id: overrides.id ?? "heading-1",
    projectId: overrides.projectId ?? "project-1",
    name: overrides.name ?? "Section",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function renderWorkspace({
  project = makeProject(),
  projectTodos = [],
  headings = [],
}: {
  project?: Project;
  projectTodos?: Todo[];
  headings?: Heading[];
} = {}) {
  vi.mocked(useProjectHeadings).mockReturnValue({
    headings,
    loading: false,
    loadHeadings: vi.fn(),
    addHeading: vi.fn(),
  });

  return render(
    <ProjectWorkspaceView
      project={project}
      projectTodos={projectTodos}
      visibleTodos={projectTodos.filter((todo) => !todo.completed)}
      loadState="loaded"
      errorMessage=""
      activeTodoId={null}
      expandedTodoId={null}
      selectedIds={new Set()}
      activeHeadingId={null}
      searchQuery=""
      onSearchChange={vi.fn()}
      onOpenNav={vi.fn()}
      onClearProject={vi.fn()}
      viewLabels={{ everything: "Everything" }}
      activeView="everything"
      onNewTask={vi.fn()}
      user={null}
      uiMode="simple"
      quickEntryPlaceholder="Add a task"
      onAddTodo={vi.fn().mockResolvedValue(null)}
      onCaptureToDesk={vi.fn().mockResolvedValue(null)}
      filtersOpen={false}
      onToggleFilters={vi.fn()}
      activeFilters={{ dateFilter: "all", priority: "", status: "" }}
      onFilterChange={vi.fn()}
      activeTagFilter=""
      onClearTagFilter={vi.fn()}
      bulkMode={false}
      onSelectAll={vi.fn()}
      onBulkComplete={vi.fn()}
      onBulkDelete={vi.fn()}
      onCancelBulk={vi.fn()}
      onSelectHeading={vi.fn()}
      viewMode="list"
      onViewModeChange={vi.fn()}
      onToggle={vi.fn()}
      onTaskClick={vi.fn()}
      onTaskOpen={vi.fn()}
      onRetry={vi.fn()}
      onSelect={vi.fn()}
      onInlineEdit={vi.fn()}
      onSave={vi.fn().mockResolvedValue(null)}
      onTagClick={vi.fn()}
      onLifecycleAction={vi.fn()}
      onReorder={vi.fn()}
      sortBy="order"
      sortOrder="asc"
      onSortChange={vi.fn()}
      onRenameProject={vi.fn()}
      onArchiveProject={vi.fn()}
      onDeleteProject={vi.fn()}
    />,
  );
}

describe("ProjectWorkspaceView overview variants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps simple projects lightweight", () => {
    renderWorkspace({
      project: makeProject({ name: "Garage cleanup" }),
      projectTodos: [
        makeTodo({ id: "t1", title: "Sort donation pile" }),
        makeTodo({ id: "t2", title: "Take paint cans to disposal", order: 1 }),
      ],
    });

    expect(screen.getByRole("heading", { name: "Garage cleanup" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Start here" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /add next task/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Open tasks" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show insights" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Sections at a glance" }),
    ).toBeNull();
  });

  it("shows a sections preview for guided projects", () => {
    const headings = [
      makeHeading({ id: "h1", name: "Bookings" }),
      makeHeading({ id: "h2", name: "Packing", sortOrder: 1 }),
    ];

    renderWorkspace({
      project: makeProject({
        name: "Apartment move",
        targetDate: "2026-04-20T09:00:00.000Z",
      }),
      headings,
      projectTodos: [
        makeTodo({ id: "t1", title: "Confirm movers", headingId: "h1" }),
        makeTodo({
          id: "t2",
          title: "Transfer utilities",
          headingId: "h1",
          dueDate: "2026-04-12T09:00:00.000Z",
        }),
        makeTodo({ id: "t3", title: "Pack kitchen", headingId: "h2" }),
        makeTodo({ id: "t4", title: "Pack books", headingId: "h2", priority: "high" }),
        makeTodo({ id: "t5", title: "Change address" }),
        makeTodo({
          id: "t6",
          title: "Book elevator slot",
          completed: true,
          status: "done",
        }),
      ],
    });

    expect(screen.getByRole("heading", { name: "Resume with this" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Sections at a glance" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open sections" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bookings/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Packing/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show insights" })).toBeNull();
  });

  it("reveals optional insights for rich projects", () => {
    const headings = [
      makeHeading({ id: "h1", name: "Venue" }),
      makeHeading({ id: "h2", name: "Guests", sortOrder: 1 }),
      makeHeading({ id: "h3", name: "Vendors", sortOrder: 2 }),
    ];

    renderWorkspace({
      project: makeProject({
        name: "Wedding planning",
        targetDate: "2026-06-15T09:00:00.000Z",
        priority: "high",
      }),
      headings,
      projectTodos: [
        makeTodo({
          id: "t1",
          title: "Review venue contract",
          headingId: "h1",
          dueDate: "2026-04-01T09:00:00.000Z",
          updatedAt: "2026-04-03T08:00:00.000Z",
        }),
        makeTodo({
          id: "t2",
          title: "Pay venue deposit",
          headingId: "h1",
          dueDate: "2026-04-05T09:00:00.000Z",
          updatedAt: "2026-04-03T08:15:00.000Z",
        }),
        makeTodo({
          id: "t3",
          title: "Draft guest list",
          headingId: "h2",
          updatedAt: "2026-04-03T08:30:00.000Z",
        }),
        makeTodo({
          id: "t4",
          title: "Collect RSVPs",
          headingId: "h2",
          status: "waiting",
          waitingOn: "Guests",
          updatedAt: "2026-04-03T08:45:00.000Z",
        }),
        makeTodo({
          id: "t5",
          title: "Finalize caterer shortlist",
          headingId: "h3",
          updatedAt: "2026-04-03T09:00:00.000Z",
        }),
        makeTodo({
          id: "t6",
          title: "Taste cake samples",
          headingId: "h3",
          updatedAt: "2026-04-03T09:15:00.000Z",
        }),
        makeTodo({ id: "t7", title: "Buy stamps", updatedAt: "2026-04-03T09:30:00.000Z" }),
        makeTodo({ id: "t8", title: "Pick invitation paper", updatedAt: "2026-04-03T09:45:00.000Z" }),
        makeTodo({
          id: "t9",
          title: "Book florist consult",
          headingId: "h3",
          updatedAt: "2026-04-02T09:00:00.000Z",
        }),
        makeTodo({
          id: "t10",
          title: "Reserve hotel block",
          headingId: "h2",
          updatedAt: "2026-04-02T10:00:00.000Z",
        }),
        makeTodo({
          id: "t11",
          title: "Choose ceremony music",
          completed: true,
          status: "done",
          headingId: "h1",
          updatedAt: "2026-04-02T11:00:00.000Z",
        }),
        makeTodo({
          id: "t12",
          title: "Confirm officiant",
          completed: true,
          status: "done",
          headingId: "h2",
          updatedAt: "2026-04-02T12:00:00.000Z",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Show insights" }));

    expect(
      screen.getByRole("heading", { name: "Sections at a glance" }),
    ).toBeTruthy();
    expect(screen.getByText("Needs attention")).toBeTruthy();
    expect(screen.getByText("Needs structure")).toBeTruthy();
    expect(screen.getByText("Recent movement")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide insights" })).toBeTruthy();
  });
});
