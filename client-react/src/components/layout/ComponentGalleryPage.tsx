import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import type { Heading, Project, Todo, User } from "../../types";
import { buildChips } from "../../utils/buildChips";
import {
  IconBoard,
  IconFocus,
  IconList,
  IconToday,
  IconTuneUp,
  IconUpcoming,
} from "../shared/Icons";
import { ProfileLauncher } from "../shared/ProfileLauncher";
import { SearchBar } from "../shared/SearchBar";
import { UndoToast, type ToastVariant } from "../shared/UndoToast";
import { TodoRow } from "../todos/TodoRow";

type PreviewMode = "list" | "board";

interface Props {
  dark: boolean;
  onBack: () => void;
}

interface GalleryToastAction {
  message: string;
  onUndo?: () => void;
  variant?: ToastVariant;
}

interface GallerySection {
  id: string;
  eyebrow: string;
  title: string;
  keywords: string[];
  content: ReactNode;
}

const timestamp = new Date().toISOString();

const SAMPLE_PROJECTS: Project[] = [
  {
    id: "project-focus",
    name: "Focus System",
    status: "active",
    priority: "high",
    area: "work",
    archived: false,
    openTodoCount: 6,
    completedTaskCount: 12,
    todoCount: 18,
    userId: "gallery-user",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  {
    id: "project-home",
    name: "Home Reset",
    status: "on_hold",
    priority: "medium",
    area: "home",
    archived: false,
    openTodoCount: 3,
    completedTaskCount: 5,
    todoCount: 8,
    userId: "gallery-user",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
];

const SAMPLE_HEADINGS: Heading[] = [];

const SAMPLE_USER: User = {
  id: "gallery-user",
  email: "design@todos.app",
  name: "Design Review",
  role: "admin",
  isVerified: true,
};

const COLOR_SWATCHES = [
  { name: "Accent", value: "var(--accent)" },
  { name: "Success", value: "var(--success)" },
  { name: "Warning", value: "var(--warning)" },
  { name: "Danger", value: "var(--danger)" },
  { name: "Surface", value: "var(--surface)" },
  { name: "Surface 3", value: "var(--surface-3)" },
];

const NAV_PREVIEW_ITEMS = [
  { key: "focus", label: "Focus", icon: IconFocus, count: 3 },
  { key: "today", label: "Today", icon: IconToday, count: 7 },
  { key: "upcoming", label: "Upcoming", icon: IconUpcoming, count: 4 },
  { key: "tuneup", label: "Tune-up", icon: IconTuneUp, count: 2 },
] as const;

function isoWithOffset(days: number) {
  const date = new Date();
  date.setHours(10, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildSampleTodo(
  overrides: Partial<Todo> & Pick<Todo, "id" | "title">,
): Todo {
  return {
    id: overrides.id,
    title: overrides.title,
    description: overrides.description ?? null,
    notes: overrides.notes ?? null,
    status: overrides.status ?? "next",
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    projectId: overrides.projectId ?? SAMPLE_PROJECTS[0].id,
    category: overrides.category ?? "Focus System",
    headingId: overrides.headingId ?? null,
    tags: overrides.tags ?? [],
    context: overrides.context ?? "desktop",
    energy: overrides.energy ?? "medium",
    dueDate: overrides.dueDate ?? null,
    startDate: overrides.startDate ?? null,
    scheduledDate: overrides.scheduledDate ?? null,
    reviewDate: overrides.reviewDate ?? null,
    doDate: overrides.doDate ?? null,
    estimateMinutes: overrides.estimateMinutes ?? 25,
    waitingOn: overrides.waitingOn ?? null,
    dependsOnTaskIds: overrides.dependsOnTaskIds ?? [],
    order: overrides.order ?? 0,
    priority: overrides.priority ?? "medium",
    archived: overrides.archived ?? false,
    firstStep: overrides.firstStep ?? "Review the current state",
    emotionalState: overrides.emotionalState ?? "exciting",
    effortScore: overrides.effortScore ?? 3,
    source: overrides.source ?? "manual",
    recurrence: overrides.recurrence ?? { type: "none" },
    subtasks: overrides.subtasks ?? [],
    userId: overrides.userId ?? "gallery-user",
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

const INITIAL_PREVIEW_TODOS: Todo[] = [
  buildSampleTodo({
    id: "preview-rich-row",
    title: "Tighten the Focus dashboard hierarchy",
    description:
      "Refine spacing, update the summary copy, and tighten the responsive layout before the next release.",
    status: "in_progress",
    priority: "high",
    dueDate: isoWithOffset(1),
    estimateMinutes: 45,
    tags: ["design-system", "release"],
    subtasks: [
      {
        id: "subtask-1",
        title: "Revisit tile spacing",
        completed: true,
        order: 0,
        todoId: "preview-rich-row",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "subtask-2",
        title: "Polish hero copy",
        completed: false,
        order: 1,
        todoId: "preview-rich-row",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: "subtask-3",
        title: "Check tablet breakpoints",
        completed: false,
        order: 2,
        todoId: "preview-rich-row",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
  }),
  buildSampleTodo({
    id: "preview-done-row",
    title: "Ship keyboard shortcut polish",
    status: "done",
    completed: true,
    completedAt: isoWithOffset(0),
    priority: "medium",
    dueDate: isoWithOffset(-1),
    estimateMinutes: 15,
    tags: ["quality"],
    category: "Workbench",
  }),
];

function SectionCard({
  eyebrow,
  title,
  children,
}: Pick<GallerySection, "eyebrow" | "title"> & { children: ReactNode }) {
  return (
    <section className="component-gallery__card">
      <span className="component-gallery__eyebrow">{eyebrow}</span>
      <h2 className="component-gallery__title">{title}</h2>
      <div className="component-gallery__body">{children}</div>
    </section>
  );
}

export function ComponentGalleryPage({ dark, onBack }: Props) {
  const [filterText, setFilterText] = useState("");
  const [searchPreviewValue, setSearchPreviewValue] = useState("overdue");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("list");
  const [activeNavKey, setActiveNavKey] =
    useState<(typeof NAV_PREVIEW_ITEMS)[number]["key"]>("focus");
  const [activeRowId, setActiveRowId] = useState(INITIAL_PREVIEW_TODOS[0].id);
  const [previewTodos, setPreviewTodos] = useState(INITIAL_PREVIEW_TODOS);
  const [toastAction, setToastAction] = useState<GalleryToastAction | null>(
    null,
  );
  const deferredFilter = useDeferredValue(filterText.trim().toLowerCase());

  const handlePreviewToast = (
    message: string,
    variant: ToastVariant = "default",
  ) => {
    setToastAction({
      message,
      variant,
      onUndo:
        variant === "success"
          ? () =>
              setToastAction({
                message: "Rolled the preview back.",
                variant: "warning",
              })
          : undefined,
    });
  };

  const updatePreviewTodo = (id: string, updater: (todo: Todo) => Todo) => {
    setPreviewTodos((current) =>
      current.map((todo) => (todo.id === id ? updater(todo) : todo)),
    );
  };

  const chipPreview = useMemo(
    () => buildChips(previewTodos[0], "spacious"),
    [previewTodos],
  );

  const sections: GallerySection[] = [
    {
      id: "buttons",
      eyebrow: "Buttons",
      title: "Actions and affordances",
      keywords: ["buttons", "cta", "actions", "toolbar"],
      content: (
        <div className="component-gallery__button-grid">
          <button type="button" className="btn btn--primary">
            Create task
          </button>
          <button type="button" className="btn">
            Export calendar
          </button>
          <button type="button" className="btn btn--danger">
            Delete selected
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={() =>
              handlePreviewToast("Previewed the action stack.", "success")
            }
          >
            Trigger success toast
          </button>
        </div>
      ),
    },
    {
      id: "navigation",
      eyebrow: "Navigation",
      title: "Workspace rail items",
      keywords: ["navigation", "sidebar", "views", "rail"],
      content: (
        <div className="component-gallery__nav-stack">
          {NAV_PREVIEW_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`workspace-view-item${activeNavKey === item.key ? " projects-rail-item--active" : ""}`}
              onClick={() => setActiveNavKey(item.key)}
            >
              <item.icon />
              <span className="nav-label">{item.label}</span>
              <span className="workspace-view-item__count">{item.count}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: "inputs",
      eyebrow: "Inputs",
      title: "Search and view switching",
      keywords: ["search", "input", "switch", "view toggle", "segmented"],
      content: (
        <div className="component-gallery__input-stack">
          <div className="component-gallery__search-preview">
            <SearchBar
              inputId="componentGallerySearchPreview"
              value={searchPreviewValue}
              onChange={setSearchPreviewValue}
            />
            <span className="component-gallery__keycap">/</span>
          </div>
          <div className="component-gallery__segmented-row">
            <div className="view-toggle" aria-label="Gallery preview mode">
              <button
                type="button"
                className={`view-toggle__btn${previewMode === "list" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setPreviewMode("list")}
                aria-label="List preview"
              >
                <IconList />
              </button>
              <button
                type="button"
                className={`view-toggle__btn${previewMode === "board" ? " view-toggle__btn--active" : ""}`}
                onClick={() => setPreviewMode("board")}
                aria-label="Board preview"
              >
                <IconBoard />
              </button>
            </div>
            <span className="component-gallery__muted-copy">
              {previewMode === "list"
                ? "List mode keeps the information dense."
                : "Board mode opens up more spatial grouping."}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "metadata",
      eyebrow: "Badges",
      title: "Task chips and metadata",
      keywords: ["chips", "badges", "tags", "metadata"],
      content: (
        <div className="component-gallery__chip-wrap">
          {chipPreview.map((chip) => (
            <span
              key={chip.key}
              className={`todo-chip todo-chip--${chip.variant}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: "rows",
      eyebrow: "Task Rows",
      title: "Live list row specimens",
      keywords: ["rows", "tasks", "todo row", "list"],
      content: (
        <div className="component-gallery__rows">
          {previewTodos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              isActive={activeRowId === todo.id}
              isExpanded={false}
              isBulkMode={false}
              isSelected={false}
              density="spacious"
              groupBy="none"
              projects={SAMPLE_PROJECTS}
              headings={SAMPLE_HEADINGS}
              onToggle={(id, completed) => {
                updatePreviewTodo(id, (current) => ({
                  ...current,
                  completed,
                  status: completed ? "done" : "in_progress",
                  completedAt: completed ? new Date().toISOString() : null,
                }));
                handlePreviewToast(
                  completed
                    ? "Marked preview row complete."
                    : "Reopened preview row.",
                  completed ? "success" : "warning",
                );
              }}
              onClick={(id) => setActiveRowId(id)}
              onKebab={(id) => {
                setActiveRowId(id);
                handlePreviewToast("Opened row details preview.");
              }}
              onSelect={(id) => setActiveRowId(id)}
              onInlineEdit={(id, title) =>
                updatePreviewTodo(id, (current) => ({ ...current, title }))
              }
              onSave={async () => undefined}
              onTagClick={(tag) =>
                handlePreviewToast(`Filtering by #${tag} in the preview.`)
              }
              onLifecycleAction={(id, action) => {
                setActiveRowId(id);
                handlePreviewToast(`Previewed "${action}" on a task row.`);
              }}
            />
          ))}
        </div>
      ),
    },
    {
      id: "identity",
      eyebrow: "Identity",
      title: "Account launcher and color tokens",
      keywords: ["profile", "launcher", "colors", "tokens"],
      content: (
        <div className="component-gallery__identity-grid">
          <div className="component-gallery__profile-preview">
            <ProfileLauncher
              user={SAMPLE_USER}
              dark={dark}
              isAdmin
              onOpenProfile={() =>
                handlePreviewToast("Opened profile preview.")
              }
              onOpenSettings={() =>
                handlePreviewToast("Opened settings preview.")
              }
              onOpenComponents={() =>
                handlePreviewToast("Already viewing the gallery.")
              }
              onToggleTheme={() =>
                handlePreviewToast("Theme toggle stays live in the real shell.")
              }
              onOpenShortcuts={() =>
                handlePreviewToast("Opened shortcuts preview.")
              }
              onOpenFeedback={() =>
                handlePreviewToast("Opened feedback preview.")
              }
              onOpenAdmin={() => handlePreviewToast("Opened admin preview.")}
              onLogout={() =>
                handlePreviewToast(
                  "Sign-out stays disabled in the gallery.",
                  "warning",
                )
              }
            />
          </div>
          <div className="component-gallery__swatches">
            {COLOR_SWATCHES.map((swatch) => (
              <div key={swatch.name} className="component-gallery__swatch">
                <span
                  className="component-gallery__swatch-dot"
                  style={{ background: swatch.value }}
                />
                <span className="component-gallery__swatch-label">
                  {swatch.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const filteredSections = useMemo(() => {
    if (!deferredFilter) return sections;

    return sections.filter((section) => {
      const haystack =
        `${section.eyebrow} ${section.title} ${section.keywords.join(" ")}`.toLowerCase();
      return haystack.includes(deferredFilter);
    });
  }, [deferredFilter, sections]);

  return (
    <div
      data-testid="component-gallery-page"
      className="component-gallery-page"
    >
      <header className="component-gallery__hero">
        <div className="component-gallery__hero-copy">
          <div className="component-gallery__hero-topline">
            <button type="button" className="btn" onClick={onBack}>
              ← Back
            </button>
            <span className="component-gallery__hero-kicker">
              Internal design inventory
            </span>
          </div>
          <h1 className="component-gallery__hero-title">Component gallery</h1>
          <p className="component-gallery__hero-summary">
            A live board of the controls, navigation patterns, and task rows
            that shape the React app. Each specimen uses the same shared classes
            and components as production screens.
          </p>
        </div>

        <div className="component-gallery__hero-tools">
          <label className="settings-field">
            <span className="settings-field__label">Filter sections</span>
            <input
              className="settings-field__input component-gallery__filter-input"
              type="text"
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="Buttons, rows, profile…"
            />
          </label>
          <div className="component-gallery__hero-stats">
            <div className="component-gallery__hero-stat">
              <strong>{filteredSections.length}</strong>
              <span>Sections</span>
            </div>
            <div className="component-gallery__hero-stat">
              <strong>6</strong>
              <span>Live modules</span>
            </div>
            <div className="component-gallery__hero-stat">
              <strong>2</strong>
              <span>Task specimens</span>
            </div>
          </div>
        </div>
      </header>

      {filteredSections.length === 0 ? (
        <div className="component-gallery__empty">
          <span className="component-gallery__empty-title">
            No sections match that filter.
          </span>
          <button
            type="button"
            className="mini-btn"
            onClick={() => setFilterText("")}
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="component-gallery__grid">
          {filteredSections.map((section) => (
            <SectionCard
              key={section.id}
              eyebrow={section.eyebrow}
              title={section.title}
            >
              {section.content}
            </SectionCard>
          ))}
        </div>
      )}

      <UndoToast action={toastAction} onDismiss={() => setToastAction(null)} />
    </div>
  );
}
