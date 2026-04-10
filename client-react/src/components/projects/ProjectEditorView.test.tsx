// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Heading, Project, Todo } from "../../types";
import { apiCall } from "../../api/client";
import { ProjectEditorView } from "./ProjectEditorView";
import { useProjectHeadings } from "../../hooks/useProjectHeadings";

vi.mock("../../hooks/useProjectHeadings", () => ({
  useProjectHeadings: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  apiCall: vi.fn(),
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
  projects?: Project[];
  projectTodos?: Todo[];
  headings?: Heading[];
  isDraft?: boolean;
  hookOverrides?: Partial<ReturnType<typeof useProjectHeadings>>;
} = {}) {
  const project = opts.project ?? makeProject();
  const projects = opts.projects ?? [project];
  const projectTodos = opts.projectTodos ?? [];
  const headings = opts.headings ?? [];
  const updateHeading = vi.fn().mockResolvedValue(makeHeading());
  const deleteHeading = vi.fn().mockResolvedValue(true);

  vi.mocked(useProjectHeadings).mockReturnValue({
    headings,
    loading: false,
    loadHeadings: vi.fn(),
    addHeading: vi.fn().mockResolvedValue(makeHeading()),
    updateHeading,
    deleteHeading,
    reorderHeadings: vi.fn().mockResolvedValue(headings),
    ...opts.hookOverrides,
  });

  const onSaveProject = vi.fn().mockResolvedValue(undefined);
  const onAddTodo = vi.fn().mockResolvedValue(undefined);
  const onSave = vi.fn().mockResolvedValue(null);

  render(
    <ProjectEditorView
      project={project}
      isDraft={opts.isDraft}
      projects={projects}
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
      onOpenProject={vi.fn()}
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
      onSave={onSave}
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

  return { onSaveProject, onAddTodo, onSave, deleteHeading };
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

    expect(screen.queryByText("Description")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show settings/i }));
    expect(screen.getByText("Description")).toBeTruthy();
    expect(screen.getByRole("button", { name: /save project/i })).toBeTruthy();
  });

  it("saves renamed projects from the hidden settings flow", async () => {
    const { onSaveProject } = renderEditor();

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Garage reset" },
    });
    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show settings/i }));
    fireEvent.click(screen.getByRole("button", { name: /save project/i }));

    expect(onSaveProject).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ name: "Garage reset" }),
    );
  });

  it("saves project area and priority from hidden settings", async () => {
    const { onSaveProject } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /project actions/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /show settings/i }));
    fireEvent.change(screen.getByLabelText("Area"), {
      target: { value: "Work" },
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "high" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save project/i }));

    expect(onSaveProject).toHaveBeenCalledWith(
      "project-1",
      expect.objectContaining({ area: "Work", priority: "high" }),
    );
  });

  it("adds tasks from the inline composer", async () => {
    const { onAddTodo } = renderEditor();

    fireEvent.click(screen.getAllByRole("button", { name: "Add task" })[0]!);
    const input = screen.getByPlaceholderText("Type a task");
    fireEvent.change(input, {
      target: { value: "Sweep floor" },
    });
    fireEvent.click(
      within(input.closest(".project-page__task-composer-form") as HTMLElement).getByRole(
        "button",
        { name: "Add task" },
      ),
    );

    expect(onAddTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sweep floor",
        projectId: "project-1",
        headingId: null,
      }),
    );
  });

  it("adds headings from the inline composer", async () => {
    const addHeading = vi.fn().mockResolvedValue(makeHeading({ id: "heading-2" }));
    renderEditor({ hookOverrides: { addHeading } });

    fireEvent.click(screen.getByRole("button", { name: "New heading" }));
    fireEvent.change(screen.getByPlaceholderText("Type a heading and press Enter"), {
      target: { value: "Second" },
    });
    fireEvent.keyDown(
      screen.getByPlaceholderText("Type a heading and press Enter"),
      { key: "Enter" },
    );

    expect(addHeading).toHaveBeenCalledWith("Second");
  });

  it("adds tasks inside a heading from that section composer", async () => {
    const { onAddTodo } = renderEditor({
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
      projectTodos: [
        makeTodo({
          id: "todo-1",
          title: "Sort donation pile",
          headingId: "heading-1",
        }),
      ],
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Add task" })[1]!);
    const input = screen.getByPlaceholderText("Type a task");
    fireEvent.change(input, {
      target: { value: "Label storage bins" },
    });
    fireEvent.click(
      within(input.closest(".project-page__task-composer-form") as HTMLElement).getByRole(
        "button",
        { name: "Add task" },
      ),
    );

    expect(onAddTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Label storage bins",
        projectId: "project-1",
        headingId: "heading-1",
      }),
    );
  });

  it("keeps a project-level task composer before the first heading when backlog is empty", async () => {
    const { onAddTodo } = renderEditor({
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
      projectTodos: [
        makeTodo({
          id: "todo-1",
          title: "Sort donation pile",
          headingId: "heading-1",
        }),
      ],
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Add task" })[0]!);
    const input = screen.getByPlaceholderText("Type a task");
    fireEvent.change(input, {
      target: { value: "Sweep floor" },
    });
    fireEvent.click(
      within(input.closest(".project-page__task-composer-form") as HTMLElement).getByRole(
        "button",
        { name: "Add task" },
      ),
    );

    expect(onAddTodo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sweep floor",
        projectId: "project-1",
        headingId: null,
      }),
    );
  });

  it("closes task action menus when clicking outside", () => {
    renderEditor({
      projectTodos: [makeTodo({ id: "todo-1", title: "Clear paint cans", order: 0 })],
    });

    fireEvent.click(screen.getByRole("button", { name: "Task actions" }));
    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("renders a draft project editor state", () => {
    renderEditor({
      project: makeProject({
        id: "draft-project",
        name: "",
        description: null,
        goal: null,
        area: null,
      }),
      isDraft: true,
    });

    expect(screen.getByPlaceholderText("Untitled project")).toBeTruthy();
    expect(screen.getByText(/save the project first/i)).toBeTruthy();
    expect(screen.getByText(/headings and tasks will appear here/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /show settings/i })).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Type .*press Enter/i)).toBeNull();
  });

  it("renders heading inline editing and heading actions", () => {
    renderEditor({
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
      projectTodos: [
        makeTodo({
          id: "todo-1",
          title: "Sort donation pile",
          headingId: "heading-1",
        }),
      ],
    });

    expect(screen.getByDisplayValue("Backlog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Heading actions" }));
    expect(screen.getByRole("button", { name: "Rename" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.getByText("Move to project")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Convert to project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("collapses and expands tasks under a heading", () => {
    renderEditor({
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
      projectTodos: [
        makeTodo({
          id: "todo-1",
          title: "Sort donation pile",
          headingId: "heading-1",
        }),
      ],
    });

    expect(screen.getByRole("button", { name: "Sort donation pile" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse Backlog" }));
    expect(screen.queryByRole("button", { name: "Sort donation pile" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand Backlog" }));
    expect(screen.getByRole("button", { name: "Sort donation pile" })).toBeTruthy();
  });

  it("moves heading tasks into a new same-named heading in the destination project", async () => {
    vi.mocked(apiCall).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeHeading({
          id: "heading-2",
          projectId: "project-2",
          name: "Backlog",
        }),
    } as Response);

    const { onSave, deleteHeading } = renderEditor({
      projects: [makeProject(), makeProject({ id: "project-2", name: "House Repairs" })],
      headings: [makeHeading({ id: "heading-1", name: "Backlog" })],
      projectTodos: [
        makeTodo({
          id: "todo-1",
          title: "Sort donation pile",
          headingId: "heading-1",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Heading actions" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "project-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Move" }));

    await waitFor(() => {
      expect(apiCall).toHaveBeenCalledWith("/projects/project-2/headings", {
        method: "POST",
        body: JSON.stringify({ name: "Backlog" }),
      });
    });
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("todo-1", {
        projectId: "project-2",
        headingId: "heading-2",
      });
      expect(deleteHeading).toHaveBeenCalledWith("heading-1");
    });
  });
});
