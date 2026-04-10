// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Heading, Project, Todo } from "../../types";
import { ProjectEditorView } from "./ProjectEditorView";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";

vi.mock("../../hooks/useProjectHeadings", () => ({
  useProjectHeadings: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "Garage Cleanup",
    description: overrides.description ?? "Clear the shelves and floor.",
    goal: overrides.goal ?? "Finish in one weekend.",
    status: overrides.status ?? "active",
    priority: overrides.priority ?? null,
    area: overrides.area ?? "home",
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
    title: overrides.title ?? "Sort donation pile",
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
    name: overrides.name ?? "Backlog",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function renderEditor(opts: {
  project?: Project;
  projectTodos?: Todo[];
  headings?: Heading[];
} = {}) {
  const project = opts.project ?? makeProject();
  const projectTodos = opts.projectTodos ?? [];
  const headings = opts.headings ?? [];

  vi.mocked(useProjectHeadings).mockReturnValue({
    headings,
    loading: false,
    loadHeadings: vi.fn(),
    addHeading: vi.fn().mockResolvedValue(makeHeading()),
    reorderHeadings: vi.fn().mockResolvedValue(headings),
  });

  const onSaveProject = vi.fn().mockResolvedValue(undefined);
  const onAddTodo = vi.fn().mockResolvedValue(undefined);

  render(
    <ProjectEditorView
      project={project}
      projectTodos={projectTodos}
      visibleTodos={projectTodos}
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
      viewLabels={{ focus: "Focus" }}
      activeView="focus"
      onNewTask={vi.fn()}
      user={null}
      uiMode="simple"
      quickEntryPlaceholder="Add"
      onAddTodo={onAddTodo}
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
      onDeferTask={vi.fn().mockResolvedValue(undefined)}
      onReplaceNext={vi.fn()}
      onSaveProject={onSaveProject}
      onArchiveProject={vi.fn()}
      onDeleteProject={vi.fn()}
      onRequestDeleteTodo={vi.fn()}
    />,
  );

  return { onSaveProject, onAddTodo };
}

describe("ProjectEditorView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the simplified project page with headings and tasks", () => {
    renderEditor({
      projectTodos: [
        makeTodo({ id: "todo-1", title: "Clear paint cans", order: 0 }),
        makeTodo({
          id: "todo-2",
          title: "Book donation pickup",
          headingId: "heading-1",
          order: 1,
        }),
      ],
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
    });

    expect(
      (screen.getByLabelText("Project name") as HTMLInputElement).value,
    ).toBe("Garage Cleanup");
    expect(screen.getAllByText("Backlog").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Clear paint cans" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Book donation pickup" })).toBeTruthy();
  });

  it("hides project settings behind the menu button", () => {
    renderEditor();

    expect(screen.queryByLabelText("Description")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save project/i })).toBeTruthy();
  });

  it("saves renamed projects from the hidden settings flow", async () => {
    const { onSaveProject } = renderEditor();

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Garage reset" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Project settings" }));
    fireEvent.click(screen.getByRole("button", { name: /save project/i }));

    expect(onSaveProject).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ name: "Garage reset" }),
    );
  });

  it("adds tasks from the compact composer", async () => {
    const { onAddTodo } = renderEditor();

    fireEvent.change(screen.getByPlaceholderText("Add a task"), {
      target: { value: "Sweep floor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(onAddTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sweep floor",
        projectId: "project-1",
        headingId: null,
      }),
    );
  });
});
