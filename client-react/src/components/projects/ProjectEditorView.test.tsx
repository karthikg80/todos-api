// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Heading, Project, Todo } from "../../types";
import { ProjectEditorView } from "./ProjectEditorView";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";
import { readDefaultView } from "./projectEditorModels";

vi.mock("../../hooks/useProjectHeadings", () => ({
  useProjectHeadings: vi.fn(),
}));

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "Home Repairs",
    description: overrides.description ?? "Fix the house.",
    goal: overrides.goal ?? "Finish core repairs.",
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
    name: overrides.name ?? "Urgent fixes",
    sortOrder: overrides.sortOrder ?? 0,
  };
}

function renderEditor(opts: {
  project?: Project;
  projectTodos?: Todo[];
  visibleTodos?: Todo[];
  headings?: Heading[];
} = {}) {
  const project = opts.project ?? makeProject();
  const projectTodos = opts.projectTodos ?? [];
  const visibleTodos = opts.visibleTodos ?? projectTodos;
  const headings = opts.headings ?? [];

  vi.mocked(useProjectHeadings).mockReturnValue({
    headings,
    loading: false,
    loadHeadings: vi.fn(),
    addHeading: vi.fn().mockResolvedValue(makeHeading()),
  });

  const onSaveProject = vi.fn().mockResolvedValue(undefined);

  render(
    <ProjectEditorView
      project={project}
      projectTodos={projectTodos}
      visibleTodos={visibleTodos}
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
      quickEntryPlaceholder="Add"
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
      onDeferTask={vi.fn().mockResolvedValue(undefined)}
      onReplaceNext={vi.fn()}
      onSaveProject={onSaveProject}
      onArchiveProject={vi.fn()}
      onDeleteProject={vi.fn()}
      onRequestDeleteTodo={vi.fn()}
    />,
  );

  return { onSaveProject };
}

describe("ProjectEditorView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders editor chrome and stats", () => {
    const todos = [
      makeTodo({ id: "a", title: "First", status: "next" }),
      makeTodo({ id: "b", title: "Second", completed: true, status: "done" }),
    ];
    renderEditor({ projectTodos: todos, visibleTodos: todos });

    expect(screen.getByText(/project editor/i)).toBeTruthy();
    expect(screen.getByDisplayValue("Home Repairs")).toBeTruthy();
    const stats = document.querySelector(".project-editor__stats");
    expect(stats).toBeTruthy();
    const statBlocks = stats?.querySelectorAll(".project-editor__stat") ?? [];
    expect(statBlocks.length).toBeGreaterThanOrEqual(4);
    const labels = [...statBlocks].map((el) =>
      el.querySelector(".project-editor__stat-label")?.textContent?.trim(),
    );
    const values = [...statBlocks].map((el) =>
      el.querySelector(".project-editor__stat-value")?.textContent?.trim(),
    );
    expect(labels[0]).toBe("Open tasks");
    expect(values[0]).toBe("1");
    expect(labels[1]).toBe("Completed");
    expect(values[1]).toBe("1");
  });

  it("save project sends dirty fields", async () => {
    const { onSaveProject } = renderEditor();
    const nameInput = screen.getByLabelText("Project name");
    fireEvent.change(nameInput, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: /save project/i }));
    expect(onSaveProject).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ name: "Renamed" }),
    );
  });

  it("defer next action is wired", () => {
    const todo = makeTodo({ id: "n1", title: "Next task", status: "next" });
    const onDefer = vi.fn().mockResolvedValue(undefined);
    const headings = [makeHeading()];
    vi.mocked(useProjectHeadings).mockReturnValue({
      headings,
      loading: false,
      loadHeadings: vi.fn(),
      addHeading: vi.fn(),
    });

    render(
      <ProjectEditorView
        project={makeProject()}
        projectTodos={[todo]}
        visibleTodos={[todo]}
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
        viewLabels={{}}
        activeView="everything"
        onNewTask={vi.fn()}
        user={null}
        uiMode="simple"
        quickEntryPlaceholder="Add"
        onAddTodo={vi.fn()}
        onCaptureToDesk={vi.fn()}
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
        onSave={vi.fn()}
        onTagClick={vi.fn()}
        onLifecycleAction={vi.fn()}
        onReorder={vi.fn()}
        sortBy="order"
        sortOrder="asc"
        onSortChange={vi.fn()}
        onDeferTask={onDefer}
        onReplaceNext={vi.fn()}
        onSaveProject={vi.fn()}
        onArchiveProject={vi.fn()}
        onDeleteProject={vi.fn()}
        onRequestDeleteTodo={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^defer$/i }));
    expect(onDefer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "n1" }),
    );
  });

  it("default view persists to localStorage", () => {
    renderEditor();
    const select = screen.getByLabelText("Default view");
    fireEvent.change(select, { target: { value: "board" } });
    expect(readDefaultView("project-1")).toBe("board");
  });
});
