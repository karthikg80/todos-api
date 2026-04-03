import { useMemo, useState } from "react";
import type { Heading, Project, Todo, UpdateTodoDto, User } from "../../types";
import {
  IconEverything,
  IconToday,
  IconWaiting,
  IconList,
  IconBoard,
  IconPlus,
} from "../shared/Icons";
import { ProfileLauncher } from "../shared/ProfileLauncher";
import { SearchBar } from "../shared/SearchBar";
import { SegmentedControl } from "../shared/SegmentedControl";
import { ToggleSwitch } from "../shared/ToggleSwitch";
import { UndoToast } from "../shared/UndoToast";
import { TodoRow } from "../todos/TodoRow";

interface Props {
  user: User | null;
  dark: boolean;
  isAdmin: boolean;
  onBack: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onOpenShortcuts: () => void;
  onOpenFeedback: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
}

const SAMPLE_PROJECTS: Project[] = [
  {
    id: "project-design",
    name: "Design system",
    status: "active",
    archived: false,
    openTodoCount: 6,
    todoCount: 8,
    completedTaskCount: 2,
    userId: "sample",
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-04-03T10:00:00.000Z",
  },
];

const SAMPLE_HEADINGS: Heading[] = [];

function makeSampleTodos(): Todo[] {
  return [
    {
      id: "gallery-overdue",
      title: "Refine task row anatomy",
      description:
        "Move chips below the title and make status/action clusters easier to scan.",
      notes: null,
      status: "next",
      completed: false,
      projectId: "project-design",
      category: "Workbench",
      headingId: null,
      tags: ["ui", "rows", "priority"],
      context: null,
      energy: "high",
      dueDate: "2026-04-01T12:00:00.000Z",
      startDate: null,
      scheduledDate: null,
      reviewDate: null,
      doDate: null,
      estimateMinutes: 45,
      waitingOn: null,
      dependsOnTaskIds: [],
      order: 0,
      priority: "high",
      archived: false,
      firstStep: null,
      emotionalState: null,
      effortScore: null,
      source: null,
      recurrence: null,
      subtasks: [
        {
          id: "subtask-1",
          title: "Rework the metadata line",
          completed: true,
          order: 0,
          todoId: "gallery-overdue",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-03T10:00:00.000Z",
        },
        {
          id: "subtask-2",
          title: "Tune state colors",
          completed: false,
          order: 1,
          todoId: "gallery-overdue",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-03T10:00:00.000Z",
        },
      ],
      userId: "sample",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    },
    {
      id: "gallery-waiting",
      title: "Align search and segmented controls",
      description:
        "Dock accessory controls into the field and strengthen active mode contrast.",
      notes: null,
      status: "waiting",
      completed: false,
      projectId: "project-design",
      category: "Workbench",
      headingId: null,
      tags: ["search", "controls"],
      context: null,
      energy: "medium",
      dueDate: "2026-04-05T12:00:00.000Z",
      startDate: null,
      scheduledDate: null,
      reviewDate: null,
      doDate: null,
      estimateMinutes: 30,
      waitingOn: "Engineering",
      dependsOnTaskIds: ["gallery-overdue"],
      order: 1,
      priority: "medium",
      archived: false,
      firstStep: null,
      emotionalState: null,
      effortScore: null,
      source: null,
      recurrence: null,
      subtasks: [],
      userId: "sample",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    },
    {
      id: "gallery-complete",
      title: "Ship a warmer button family",
      description:
        "Primary, secondary, ghost, and destructive should feel related but clearly distinct.",
      notes: null,
      status: "done",
      completed: true,
      completedAt: "2026-04-02T09:00:00.000Z",
      projectId: "project-design",
      category: "Workbench",
      headingId: null,
      tags: ["buttons"],
      context: null,
      energy: null,
      dueDate: "2026-04-02T12:00:00.000Z",
      startDate: null,
      scheduledDate: null,
      reviewDate: null,
      doDate: null,
      estimateMinutes: 20,
      waitingOn: null,
      dependsOnTaskIds: [],
      order: 2,
      priority: "low",
      archived: false,
      firstStep: null,
      emotionalState: null,
      effortScore: null,
      source: null,
      recurrence: { type: "weekly", interval: 1, nextOccurrence: null },
      subtasks: [],
      userId: "sample",
      createdAt: "2026-04-01T10:00:00.000Z",
      updatedAt: "2026-04-03T10:00:00.000Z",
    },
  ];
}

export function ComponentGalleryPage({
  user,
  dark,
  isAdmin,
  onBack,
  onOpenProfile,
  onOpenSettings,
  onToggleTheme,
  onOpenShortcuts,
  onOpenFeedback,
  onOpenAdmin,
  onLogout,
}: Props) {
  const [searchValue, setSearchValue] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [layoutMode, setLayoutMode] = useState("list");
  const [toggles, setToggles] = useState({
    groupByStatus: true,
    hideCompleted: false,
  });
  const [toastAction, setToastAction] = useState<{
    message: string;
    variant?: "default" | "success" | "error" | "warning";
    onUndo?: () => void;
  } | null>(null);
  const [activeTodoId, setActiveTodoId] = useState("gallery-overdue");
  const [todos, setTodos] = useState<Todo[]>(() => makeSampleTodos());

  const sampleTodos = useMemo(
    () =>
      todos.filter((todo) =>
        searchValue.trim()
          ? todo.title.toLowerCase().includes(searchValue.toLowerCase())
          : true,
      ),
    [searchValue, todos],
  );

  const handleToggleTodo = (id: string, completed: boolean) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              completed,
              status: completed ? "done" : "next",
            }
          : todo,
      ),
    );
  };

  const handleInlineEdit = (id: string, title: string) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, title } : todo)),
    );
  };

  const handleSave = async (id: string, dto: UpdateTodoDto) => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, ...dto } : todo)),
    );
    return Promise.resolve();
  };

  return (
    <div className="component-gallery-page">
      <header className="component-gallery-page__header">
        <button className="btn" onClick={onBack}>
          ← Back
        </button>
        <div>
          <p className="component-gallery-page__eyebrow">
            Internal component system
          </p>
          <h1 className="component-gallery-page__title">
            React component gallery
          </h1>
        </div>
      </header>

      <div className="component-gallery-page__grid">
        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">Buttons</span>
          </div>
          <div className="component-gallery-actions">
            <button className="btn btn--primary">
              <IconPlus /> New task
            </button>
            <button className="btn">Suggest next work</button>
            <button className="btn btn--ghost">Share view</button>
            <button className="btn btn--danger">Clear completed</button>
          </div>
        </section>

        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">
              Search and modes
            </span>
          </div>
          <div className="component-gallery-stack">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              inputId="componentGallerySearch"
              shortcutHint="/"
            />
            <SegmentedControl
              value={layoutMode}
              onChange={setLayoutMode}
              ariaLabel="Gallery layout"
              options={[
                { value: "list", label: "List" },
                { value: "board", label: "Board" },
                { value: "focus", label: "Focus" },
              ]}
            />
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              ariaLabel="Task view"
              iconOnly
              options={[
                { value: "list", ariaLabel: "List view", icon: <IconList /> },
                {
                  value: "board",
                  ariaLabel: "Board view",
                  icon: <IconBoard />,
                },
              ]}
            />
          </div>
        </section>

        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">Rail items</span>
          </div>
          <div className="component-gallery-rail">
            <button
              className="workspace-view-item projects-rail-item--active"
              type="button"
            >
              <IconEverything />
              <span className="nav-label">Everything</span>
              <span className="workspace-view-item__count">12</span>
            </button>
            <button className="workspace-view-item" type="button">
              <IconToday />
              <span className="nav-label">Today</span>
              <span className="workspace-view-item__count">4</span>
            </button>
            <button className="workspace-view-item" type="button">
              <IconWaiting />
              <span className="nav-label">Waiting</span>
              <span className="workspace-view-item__count">2</span>
            </button>
          </div>
        </section>

        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">Switches</span>
          </div>
          <div className="component-gallery-stack">
            <ToggleSwitch
              checked={toggles.groupByStatus}
              label="Group by status"
              description="Use the stronger semantic cluster in the list."
              onChange={(checked) =>
                setToggles((current) => ({
                  ...current,
                  groupByStatus: checked,
                }))
              }
            />
            <ToggleSwitch
              checked={toggles.hideCompleted}
              label="Hide completed"
              description="Keep completed rows available but visually quieter."
              onChange={(checked) =>
                setToggles((current) => ({
                  ...current,
                  hideCompleted: checked,
                }))
              }
            />
            <ToggleSwitch
              checked
              disabled
              label="Auto-archive done work"
              description="Disabled specimen for the system states."
              onChange={() => {}}
            />
          </div>
        </section>

        <section className="component-gallery-card component-gallery-card--wide">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">Task rows</span>
          </div>
          <div className="component-gallery-list">
            {sampleTodos.map((todo, index) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                isActive={activeTodoId === todo.id}
                isExpanded={false}
                isBulkMode={false}
                isSelected={false}
                density={index === 0 ? "spacious" : "normal"}
                projects={SAMPLE_PROJECTS}
                headings={SAMPLE_HEADINGS}
                onToggle={handleToggleTodo}
                onClick={setActiveTodoId}
                onKebab={setActiveTodoId}
                onSelect={() => {}}
                onInlineEdit={handleInlineEdit}
                onSave={handleSave}
                onTagClick={() => {}}
                onLifecycleAction={() => {}}
              />
            ))}
          </div>
        </section>

        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">Tokens</span>
          </div>
          <div className="component-gallery-swatches">
            {[
              {
                label: "Surface",
                role: "Default cards",
                css: "var(--surface)",
              },
              {
                label: "Surface 2",
                role: "Nested chrome",
                css: "var(--surface-2)",
              },
              {
                label: "Accent",
                role: "Primary actions",
                css: "var(--accent)",
              },
              {
                label: "Warning",
                role: "Time pressure",
                css: "var(--warning)",
              },
              {
                label: "Danger",
                role: "Destructive and overdue",
                css: "var(--danger)",
              },
            ].map((swatch) => (
              <div key={swatch.label} className="component-gallery-swatch">
                <span
                  className="component-gallery-swatch__sample"
                  style={{ background: swatch.css }}
                />
                <span className="component-gallery-swatch__label">
                  {swatch.label}
                </span>
                <span className="component-gallery-swatch__role">
                  {swatch.role}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="component-gallery-card">
          <div className="component-gallery-card__header">
            <span className="component-gallery-card__label">
              Identity and toast
            </span>
          </div>
          <div className="component-gallery-stack">
            <ProfileLauncher
              user={user}
              dark={dark}
              isAdmin={isAdmin}
              onOpenProfile={onOpenProfile}
              onOpenSettings={onOpenSettings}
              onToggleTheme={onToggleTheme}
              onOpenShortcuts={onOpenShortcuts}
              onOpenFeedback={onOpenFeedback}
              onOpenComponentGallery={() => {}}
              onOpenAdmin={onOpenAdmin}
              onLogout={onLogout}
            />
            <button
              className="btn btn--primary"
              onClick={() =>
                setToastAction({
                  message: "Added 5 components to the specimen board",
                  variant: "success",
                  onUndo: () => setToastAction(null),
                })
              }
            >
              Trigger success toast
            </button>
          </div>
        </section>
      </div>

      <UndoToast action={toastAction} onDismiss={() => setToastAction(null)} />
    </div>
  );
}
