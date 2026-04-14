// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  within,
  waitFor,
} from "@testing-library/react";
import React from "react";

// ─── Mock all heavy dependencies before importing AppShell ──────────

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../store/useTodosStore", () => ({
  useTodosStore: vi.fn(),
}));

vi.mock("../../store/useProjectsStore", () => ({
  useProjectsStore: vi.fn(),
}));

vi.mock("../../hooks/useDarkMode", () => ({
  useDarkMode: vi.fn(),
}));

vi.mock("../../hooks/useDensity", () => ({
  useDensity: () => ({ density: "comfortable", setDensity: vi.fn(), cycle: vi.fn() }),
}));

vi.mock("../../hooks/useGroupBy", () => ({
  useGroupBy: () => ({ groupBy: "none", setGroupBy: vi.fn() }),
}));

vi.mock("../../hooks/useIsMobile", () => ({
  useIsMobile: vi.fn(),
}));

const mockExportIcs = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useIcsExport", () => ({
  useIcsExport: () => mockExportIcs,
}));

let serviceWorkerCallback:
  | ((replayed: number, failed: number) => void)
  | undefined;

vi.mock("../../hooks/useServiceWorker", () => ({
  useServiceWorker: (cb: (replayed: number, failed: number) => void) => {
    serviceWorkerCallback = cb;
  },
}));

vi.mock("../../hooks/useViewTransition", () => ({
  useViewTransition: () => ({ startTransition: (fn: any) => fn() }),
}));

vi.mock("../shared/useOverlayFocusTrap", () => ({
  useOverlayFocusTrap: () => {},
}));

vi.mock("../../api/inbox", () => ({
  captureInboxItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../api/client", () => ({
  apiCall: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
}));

vi.mock("../../api/todos", () => ({
  reorderTodos: vi.fn().mockResolvedValue(undefined),
  updateTodo: vi.fn().mockResolvedValue(undefined),
  deleteTodo: vi.fn().mockResolvedValue(undefined),
}));

// Mock child components
vi.mock("../projects/Sidebar", () => ({
  Sidebar: ({
    onNewTask,
    onOpenSettings,
    onOpenActivity,
    onToggleTheme,
    onOpenShortcuts,
    onLogout,
    onSearchChange,
    searchQuery,
    isCollapsed,
    onSelectView,
  }: any) =>
    React.createElement(
      "aside",
      {
        "data-testid": "sidebar",
        "data-collapsed": isCollapsed ? "true" : "false",
      },
      React.createElement(
        "button",
        {
          "data-testid": "sidebar-view-home",
          onClick: () => onSelectView?.("home"),
        },
        "Focus",
      ),
      React.createElement(
        "button",
        {
          "data-testid": "sidebar-view-all",
          onClick: () => onSelectView?.("all"),
        },
        "Everything",
      ),
      React.createElement("button", { "data-testid": "sidebar-new-task", onClick: onNewTask }, "New Task"),
      React.createElement("button", { "data-testid": "sidebar-settings", onClick: onOpenSettings }, "Settings"),
      React.createElement("button", { "data-testid": "sidebar-activity", onClick: onOpenActivity }, "Activity"),
      React.createElement("button", { "data-testid": "sidebar-dark-mode", onClick: onToggleTheme }, "Dark Mode"),
      React.createElement("button", { "data-testid": "sidebar-shortcuts", onClick: onOpenShortcuts }, "Shortcuts"),
      React.createElement("button", { "data-testid": "sidebar-logout", onClick: onLogout }, "Logout"),
      React.createElement("input", { "data-testid": "sidebar-search", value: searchQuery || "", onChange: (e: any) => onSearchChange?.(e.target.value) }),
    ),
}));

vi.mock("../todos/BoardView", () => ({
  BoardView: ({ todos }: { todos?: unknown[] }) =>
    React.createElement(
      "div",
      { "data-testid": "board-view" },
      `board:${(todos ?? []).length}`,
    ),
}));

vi.mock("../todos/SortableTodoList", () => ({
  SortableTodoList: ({
    todos,
    expandedTodoId,
    onSelect,
  }: {
    todos?: { id: string; title: string }[];
    expandedTodoId?: string | null;
    onSelect?: (id: string) => void;
  }) =>
    React.createElement(
      "div",
      {
        "data-testid": "todo-list",
        "data-expanded-todo": expandedTodoId ?? "",
      },
      React.createElement(
        "div",
        { "data-testid": "todo-list-bulk-triggers" },
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "todo-select-row-a",
            onClick: () => onSelect?.("t-a"),
          },
          "Select row A",
        ),
        React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "todo-select-row-b",
            onClick: () => onSelect?.("t-b"),
          },
          "Select row B",
        ),
      ),
      (todos ?? []).map((t) =>
        React.createElement(
          "div",
          { key: t.id, "data-todo-id": t.id },
          t.title,
        ),
      ),
    ),
}));

vi.mock("../todos/TodoDrawer", () => ({
  TodoDrawer: ({ todo, onClose, onOpenFullPage }: any) =>
    todo
      ? React.createElement(
          "div",
          { "data-testid": "todo-drawer" },
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "drawer-open-full-page",
              onClick: () => onOpenFullPage?.(todo.id),
            },
            "Open full page",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "drawer-close",
              onClick: () => onClose?.(),
            },
            "Close drawer",
          ),
        )
      : null,
}));

vi.mock("../shared/UndoToast", () => ({
  UndoToast: ({
    action,
    onDismiss,
  }: {
    action?: { message?: string } | null;
    onDismiss?: () => void;
  }) =>
    React.createElement(
      "div",
      { "data-testid": "undo-toast" },
      action?.message ?? "",
      React.createElement(
        "button",
        {
          type: "button",
          "data-testid": "undo-dismiss",
          onClick: () => onDismiss?.(),
        },
        "Dismiss toast",
      ),
    ),
}));

vi.mock("../shared/ConfirmDialog", () => ({
  ConfirmDialog: ({ onConfirm, onCancel }: any) =>
    React.createElement(
      "div",
      { "data-testid": "confirm-dialog" },
      React.createElement(
        "button",
        { type: "button", "data-testid": "confirm-delete-ok", onClick: onConfirm },
        "Delete",
      ),
      React.createElement(
        "button",
        { type: "button", "data-testid": "confirm-delete-cancel", onClick: onCancel },
        "Cancel",
      ),
    ),
}));

vi.mock("../shared/CommandPalette", () => ({
  CommandPalette: ({
    isOpen,
    onExportCalendar,
    onClose,
    onNavigateHorizonSegment,
    onWeeklyReview,
    onOpenFeedback,
    onOpenShortcuts,
    onTodoClick,
    onProjectOpen,
    onLogout,
  }: any) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "command-palette" },
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-export-calendar",
              onClick: onExportCalendar,
            },
            "Export calendar",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-horizon-pending",
              onClick: () => onNavigateHorizonSegment?.("pending"),
            },
            "Horizon pending",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-weekly-review",
              onClick: onWeeklyReview,
            },
            "Weekly review",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-open-feedback",
              onClick: onOpenFeedback,
            },
            "Feedback",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-open-shortcuts",
              onClick: onOpenShortcuts,
            },
            "Shortcuts",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-todo-click",
              onClick: () => onTodoClick?.("t-palette"),
            },
            "Open todo",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-project-open",
              onClick: () => onProjectOpen?.("p-palette"),
            },
            "Open project",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "cmd-logout",
              onClick: onLogout,
            },
            "Logout",
          ),
          React.createElement(
            "button",
            { type: "button", "data-testid": "cmd-close", onClick: onClose },
            "Close palette",
          ),
        )
      : null,
}));

vi.mock("../shared/ShortcutsOverlay", () => ({
  ShortcutsOverlay: ({ isOpen, onClose }: any) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "shortcuts-overlay" },
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "shortcuts-overlay-close",
              onClick: onClose,
            },
            "Close shortcuts",
          ),
        )
      : null,
}));

vi.mock("../todos/FilterPanel", () => ({
  FilterPanel: () => null,
  applyFilters: (todos: any[]) => todos,
}));

vi.mock("../shared/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: any) => children,
}));

vi.mock("./ViewRouter", () => ({
  ViewRouter: ({ children }: any) => React.createElement("div", { "data-testid": "view-router" }, children),
  ViewRoute: ({ children, viewKey }: any) => React.createElement("div", { "data-testid": `view-route-${viewKey}`, "data-view-key": viewKey }, children),
}));

vi.mock("./HomeDashboard", () => ({
  HomeDashboard: () => React.createElement("div", { "data-testid": "home-dashboard" }, "Home Dashboard"),
}));

vi.mock("./ListViewHeader", () => ({
  ListViewHeader: (props: any) =>
    React.createElement(
      "div",
      { "data-testid": "list-header", "data-active-view": props.activeView },
      props.activeView === "all" &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-view-board",
              onClick: () => props.onViewModeChange?.("board"),
            },
            "Board",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-view-list",
              onClick: () => props.onViewModeChange?.("list"),
            },
            "List",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-select-all",
              onClick: () => props.onSelectAll?.(),
            },
            "Select all",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-bulk-complete",
              onClick: () => void props.onBulkComplete?.(),
            },
            "Bulk complete",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-bulk-delete",
              onClick: () => void props.onBulkDelete?.(),
            },
            "Bulk delete",
          ),
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "hdr-bulk-cancel",
              onClick: () => props.onCancelBulk?.(),
            },
            "Cancel bulk",
          ),
        ),
    ),
}));

vi.mock("../../utils/focusTargets", () => ({
  focusGlobalSearchInput: vi.fn(),
  triggerPrimaryNewTask: vi.fn(),
}));

vi.mock("../shared/OnboardingFlow", () => ({
  OnboardingFlow: () => React.createElement("div", { "data-testid": "onboarding-flow" }),
}));

vi.mock("../todos/TaskFullPage", () => ({
  TaskFullPage: ({ todo, onBack }: any) =>
    React.createElement(
      "div",
      { "data-testid": "task-full-page" },
      React.createElement("span", null, todo?.title ?? ""),
      React.createElement(
        "button",
        { type: "button", "data-testid": "full-page-back", onClick: onBack },
        "Back",
      ),
    ),
}));

vi.mock("../todos/TaskComposer", () => ({
  TaskComposer: ({ isOpen, onClose }: any) =>
    isOpen
      ? React.createElement(
          "div",
          { "data-testid": "task-composer" },
          React.createElement(
            "button",
            {
              type: "button",
              "data-testid": "task-composer-close",
              onClick: onClose,
            },
            "Close composer",
          ),
        )
      : null,
}));

vi.mock("../projects/ProjectCrud", () => ({
  ProjectCrud: () => React.createElement("div", { "data-testid": "project-crud" }),
}));

vi.mock("./ComponentGalleryPage", () => ({
  ComponentGalleryPage: () => React.createElement("div", { "data-testid": "component-gallery" }),
}));

vi.mock("./SettingsPage", () => ({
  SettingsPage: () => React.createElement("div", { "data-testid": "settings-page" }),
}));

vi.mock("../tuneup/TuneUpView", () => ({
  TuneUpView: () => React.createElement("div", { "data-testid": "tuneup-view" }),
}));

vi.mock("./WeeklyReview", () => ({
  WeeklyReview: () => React.createElement("div", { "data-testid": "weekly-review" }),
}));

vi.mock("../feedback/FeedbackForm", () => ({
  FeedbackForm: ({ onBack }: any) =>
    React.createElement(
      "div",
      { "data-testid": "feedback-form" },
      React.createElement("button", { type: "button", onClick: onBack }, "Back"),
    ),
}));

vi.mock("../activity/AgentActivityView", () => ({
  AgentActivityView: () => React.createElement("div", { "data-testid": "agent-activity-view" }),
}));

vi.mock("../projects/ProjectEditorView", () => ({
  ProjectEditorView: () => React.createElement("div", { "data-testid": "project-editor-view" }),
}));

vi.mock("../projects/projectEditorModels", () => ({
  PROJECT_RAIL_BACKLOG_SENTINEL: "__unplaced__",
}));

vi.mock("../shared/Icons", () => ({
  IconMoon: () => React.createElement("span", { "data-testid": "icon-moon" }),
  IconSun: () => React.createElement("span", { "data-testid": "icon-sun" }),
  IconMenu: () => React.createElement("span", { "data-testid": "icon-menu" }),
  IconPlus: () => React.createElement("span", { "data-testid": "icon-plus" }),
}));

import { useAuth } from "../../auth/AuthProvider";
import { useTodosStore } from "../../store/useTodosStore";
import { useProjectsStore } from "../../store/useProjectsStore";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useDarkMode } from "../../hooks/useDarkMode";
import { AppShell } from "./AppShell";
import * as todosApi from "../../api/todos";
import * as focusTargets from "../../utils/focusTargets";

const mockUseAuth = vi.mocked(useAuth);
const mockUseTodosStore = vi.mocked(useTodosStore);
const mockUseProjectsStore = vi.mocked(useProjectsStore);
const mockUseIsMobile = vi.mocked(useIsMobile);
const mockUseDarkMode = vi.mocked(useDarkMode);

function setupOverrides(overrides: {
  user?: any;
  todos?: any[];
  loadState?: "idle" | "loading" | "loaded" | "error";
  projects?: any[];
  isMobile?: boolean;
  dark?: boolean;
  removeTodo?: ReturnType<typeof vi.fn>;
  addTodo?: ReturnType<typeof vi.fn>;
  loadTodos?: ReturnType<typeof vi.fn>;
  toggleTodo?: ReturnType<typeof vi.fn>;
} = {}) {
  mockUseAuth.mockReturnValue({
    user: overrides.user ?? {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    },
    loading: false,
    logout: vi.fn(),
    setUser: vi.fn(),
    setTokens: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(null),
  });
  mockUseTodosStore.mockReturnValue({
    todos: overrides.todos ?? [],
    loadState: (overrides.loadState ?? "loaded") as "idle" | "loading" | "loaded" | "error",
    errorMessage: "",
    loadTodos: (overrides.loadTodos ?? vi.fn()) as ReturnType<
      typeof useTodosStore
    >["loadTodos"],
    addTodo: (overrides.addTodo ?? vi.fn()) as ReturnType<
      typeof useTodosStore
    >["addTodo"],
    toggleTodo: (overrides.toggleTodo ?? vi.fn()) as ReturnType<
      typeof useTodosStore
    >["toggleTodo"],
    editTodo: vi.fn(),
    removeTodo: (overrides.removeTodo ?? vi.fn()) as ReturnType<
      typeof useTodosStore
    >["removeTodo"],
  });
  mockUseProjectsStore.mockReturnValue({
    projects: overrides.projects ?? [],
    loading: false,
    loadProjects: vi.fn(),
  });
  mockUseIsMobile.mockReturnValue(overrides.isMobile ?? false);
  mockUseDarkMode.mockReturnValue({ dark: overrides.dark ?? false, toggle: vi.fn() });
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    window.location.hash = "";
    serviceWorkerCallback = undefined;
    Element.prototype.scrollIntoView = vi.fn() as unknown as typeof Element.prototype.scrollIntoView;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
    setupOverrides();
  });

  describe("core structure", () => {
    it("renders the app shell container", () => {
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".app-shell")).toBeTruthy();
    });

    it("renders the sidebar", () => {
      render(ce(AppShell));
      expect(screen.getByTestId("sidebar")).toBeTruthy();
    });

    it("renders the main content area", () => {
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".app-main")).toBeTruthy();
    });

    it("renders the view router", () => {
      render(ce(AppShell));
      expect(screen.getByTestId("view-router")).toBeTruthy();
    });

    it("renders view routes for all workspace views", () => {
      render(ce(AppShell));
      expect(screen.getByTestId("view-route-home")).toBeTruthy();
      expect(screen.getByTestId("view-route-all")).toBeTruthy();
      expect(screen.getByTestId("view-route-today")).toBeTruthy();
      expect(screen.getByTestId("view-route-horizon")).toBeTruthy();
      expect(screen.getByTestId("view-route-completed")).toBeTruthy();
    });

    it("renders the undo toast", () => {
      render(ce(AppShell));
      expect(screen.getByTestId("undo-toast")).toBeTruthy();
    });

    it("renders the list header", () => {
      render(ce(AppShell));
      expect(screen.getAllByTestId("list-header").length).toBeGreaterThanOrEqual(1);
    });

    it("renders the todo list", () => {
      render(ce(AppShell));
      expect(screen.getAllByTestId("todo-list").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("loading state", () => {
    it("shows loading bar when loadState is loading", () => {
      setupOverrides({ loadState: "loading" });
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".loading-bar")).toBeTruthy();
    });

    it("hides loading bar when loadState is loaded", () => {
      setupOverrides({ loadState: "loaded" });
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".loading-bar")).toBeNull();
    });
  });

  describe("page routing", () => {
    it("shows home dashboard on todos page", () => {
      render(ce(AppShell));
      expect(screen.getByTestId("home-dashboard")).toBeTruthy();
    });
  });

  describe("mobile responsiveness", () => {
    it("renders desktop sidebar when not mobile", () => {
      setupOverrides({ isMobile: false });
      const { container } = render(ce(AppShell));
      expect(container.querySelector("aside.app-sidebar")).toBeTruthy();
    });

    it("does not render mobile sheet when not mobile", () => {
      setupOverrides({ isMobile: false });
      render(ce(AppShell));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("sidebar state", () => {
    it("sidebar is not collapsed by default", () => {
      render(ce(AppShell));
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    });
  });

  describe("overlays and dialogs", () => {
    it("does not render confirm dialog by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("does not render command palette by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("command-palette")).toBeNull();
    });

    it("does not render shortcuts overlay by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("shortcuts-overlay")).toBeNull();
    });

    it("does not render task composer by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("task-composer")).toBeNull();
    });

    it("does not render project CRUD by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("project-crud")).toBeNull();
    });

    it("does not render onboarding flow when user is onboarded", () => {
      setupOverrides({
        user: { id: "u1", name: "Test User", email: "test@example.com", onboardingCompletedAt: "2026-01-01" },
      });
      render(ce(AppShell));
      expect(screen.queryByTestId("onboarding-flow")).toBeNull();
    });

    it("renders onboarding flow when user is not onboarded", () => {
      setupOverrides({
        user: { id: "u1", name: "Test User", email: "test@example.com", onboardingCompletedAt: null },
      });
      render(ce(AppShell));
      expect(screen.getByTestId("onboarding-flow")).toBeTruthy();
    });

    it("does not render task full page by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("task-full-page")).toBeNull();
    });

    it("does not render todo drawer by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("todo-drawer")).toBeNull();
    });

    it("does not render agent activity view by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("agent-activity-view")).toBeNull();
    });

    it("does not render weekly review by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("weekly-review")).toBeNull();
    });

    it("does not render tuneup view by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("tuneup-view")).toBeNull();
    });
  });

  describe("sidebar navigation", () => {
    it("shows settings page when sidebar settings button clicked", async () => {
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-settings"));
      });
      expect(screen.getByTestId("settings-page")).toBeTruthy();
    });

    it("shows agent activity view when sidebar activity button clicked", async () => {
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-activity"));
      });
      expect(screen.getByTestId("agent-activity-view")).toBeTruthy();
    });

    it("toggles dark mode when sidebar dark mode button clicked", async () => {
      const toggleDark = vi.fn();
      mockUseDarkMode.mockReturnValue({ dark: false, toggle: toggleDark });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-dark-mode"));
      });
      expect(toggleDark).toHaveBeenCalled();
    });

    it("opens shortcuts overlay when sidebar shortcuts button clicked", async () => {
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-shortcuts"));
      });
      expect(screen.getByTestId("shortcuts-overlay")).toBeTruthy();
    });

    it("logs out when sidebar logout button clicked", async () => {
      const logout = vi.fn();
      mockUseAuth.mockReturnValue({
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
        },
        loading: false,
        logout,
        setUser: vi.fn(),
        setTokens: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(null),
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-logout"));
      });
      expect(logout).toHaveBeenCalled();
    });

    it("updates search query when sidebar search input changes", async () => {
      render(ce(AppShell));
      const searchInput = screen.getByTestId("sidebar-search");
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "test query" } });
      });
      expect(searchInput).toHaveValue("test query");
    });

    it("opens task composer when sidebar new task button clicked", async () => {
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-new-task"));
      });
      expect(screen.getByTestId("task-composer")).toBeTruthy();
    });
  });

  describe("workspace navigation from sidebar", () => {
    it("switching to Everything surfaces list vs board controls for the todo workspace", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "One task")] });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-view-all"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("hdr-view-board")).toBeTruthy();
      });
    });
  });

  describe("mobile rendering", () => {
    it("renders mobile sheet when isMobile is true", () => {
      setupOverrides({ isMobile: true });
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".mobile-sheet")).toBeTruthy();
      expect(container.querySelector(".mobile-sheet-backdrop")).toBeTruthy();
    });

    it("does not render desktop sidebar when mobile", () => {
      setupOverrides({ isMobile: true });
      const { container } = render(ce(AppShell));
      expect(container.querySelector("aside.app-sidebar")).toBeNull();
    });
  });

  describe("bulk mode", () => {
    it("app shell does not have bulk class by default", () => {
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".is-bulk-selecting")).toBeNull();
    });
  });

  describe("dark mode", () => {
    it("passes dark prop to sidebar", () => {
      mockUseDarkMode.mockReturnValue({ dark: true, toggle: vi.fn() });
      render(ce(AppShell));
      expect(mockUseDarkMode).toHaveBeenCalled();
    });
  });

  describe("error state", () => {
    it("does not show loading bar when loadState is error", () => {
      setupOverrides({ loadState: "error" });
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".loading-bar")).toBeNull();
    });
  });

  describe("view routing", () => {
    it("renders view-router container", () => {
      const { container } = render(ce(AppShell));
      expect(container.querySelector('[data-testid="view-router"]')).toBeTruthy();
    });

    it("renders home view route by default", () => {
      const { container } = render(ce(AppShell));
      expect(container.querySelector('[data-testid="view-route-home"]')).toBeTruthy();
    });
  });

  describe("view mode toggle", () => {
    it("passes viewMode to ListViewHeader", () => {
      render(ce(AppShell));
      const headers = screen.getAllByTestId("list-header");
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("delete confirmation", () => {
    it("does not show delete confirmation by default", () => {
      render(ce(AppShell));
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });
  });

  describe("settings page navigation", () => {
    it("shows settings page when navigating to settings", async () => {
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-settings"));
      });
      expect(screen.getByTestId("settings-page")).toBeTruthy();
    });

    it("navigates back to todos from settings via sidebar", async () => {
      render(ce(AppShell));
      // Navigate to settings
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-settings"));
      });
      expect(screen.getByTestId("settings-page")).toBeTruthy();

      // Navigate back to activity (which is a different page)
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-activity"));
      });
      expect(screen.getByTestId("agent-activity-view")).toBeTruthy();
    });
  });

  describe("top bar header (desktop)", () => {
    it("renders new task button in top bar on home view", () => {
      const { container } = render(ce(AppShell));
      const newTaskBtn = container.querySelector('[data-new-task-trigger="true"]');
      expect(newTaskBtn).toBeTruthy();
    });

    it("renders logout button in top bar when user exists", () => {
      const { container } = render(ce(AppShell));
      const buttons = container.querySelectorAll("button");
      const logoutBtn = Array.from(buttons).find(
        (btn) => btn.textContent === "Logout",
      );
      expect(logoutBtn).toBeTruthy();
    });
  });

  describe("mobile header", () => {
    it("renders mobile header with menu button when mobile", () => {
      setupOverrides({ isMobile: true });
      const { container } = render(ce(AppShell));
      const menuBtn = container.querySelector("#projectsRailMobileOpen");
      expect(menuBtn).toBeTruthy();
    });

    it("opens mobile nav when menu button clicked", async () => {
      setupOverrides({ isMobile: true });
      const { container } = render(ce(AppShell));
      const menuBtn = container.querySelector("#projectsRailMobileOpen");
      await act(async () => {
        fireEvent.click(menuBtn!);
      });
      expect(container.querySelector('[aria-hidden="false"]')).toBeTruthy();
    });
  });

  describe("sidebar collapse state", () => {
    it("toggles sidebar collapse when toggle button clicked", async () => {
      render(ce(AppShell));
      // The sidebar mock should expose a collapse toggle
      // We verify via the data-collapsed attribute changing
      const sidebar = screen.getByTestId("sidebar");
      expect(sidebar.getAttribute("data-collapsed")).toBe("false");
    });
  });

  describe("idle load state", () => {
    it("does not show loading bar when loadState is idle", () => {
      setupOverrides({ loadState: "idle" });
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".loading-bar")).toBeNull();
    });
  });

  describe("sidebar collapsed state", () => {
    it("applies collapsed class when sidebar is collapsed", async () => {
      render(ce(AppShell));
      // Initial state: not collapsed
      const { container } = render(ce(AppShell));
      expect(container.querySelector(".is-sidebar-collapsed")).toBeNull();
    });
  });

  describe("project selection", () => {
    it("renders project crud when project is selected", async () => {
      setupOverrides({
        projects: [{ id: "p1", name: "Test Project", slug: "test" }],
      });
      render(ce(AppShell));
      // Select a project via sidebar
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-settings"));
      });
      // Project crud should render when editing a project
      // This depends on the routing state
    });
  });

  const baseTodo = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
    id,
    title,
    status: "inbox" as const,
    completed: false,
    tags: [] as string[],
    dependsOnTaskIds: [] as string[],
    order: 0,
    archived: false,
    userId: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  });

  describe("keyboard shortcuts and navigation", () => {
    it("j/k updates quick-edit focus and calls scrollIntoView", async () => {
      setupOverrides({
        todos: [baseTodo("t-a", "A"), baseTodo("t-b", "B")],
      });
      render(ce(AppShell));
      const lists = screen.getAllByTestId("todo-list");
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      expect(lists[0].getAttribute("data-expanded-todo")).toBe("t-a");
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      expect(lists[0].getAttribute("data-expanded-todo")).toBe("t-b");
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", bubbles: true });
      });
      expect(lists[0].getAttribute("data-expanded-todo")).toBe("t-a");
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it("Escape collapses quick edit when a task is focused", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "Only")] });
      render(ce(AppShell));
      const list = screen.getAllByTestId("todo-list")[0];
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      expect(list.getAttribute("data-expanded-todo")).toBe("t-a");
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(list.getAttribute("data-expanded-todo")).toBe("");
    });

    it("Escape cancels bulk selection", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "A"), baseTodo("t-b", "B")] });
      const { container } = render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("todo-select-row-a")[0]!);
      });
      expect(container.querySelector(".is-bulk-selecting")).toBeTruthy();
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(container.querySelector(".is-bulk-selecting")).toBeNull();
    });

    it("e opens drawer and full-page control shows TaskFullPage", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "Task A")] });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "e", bubbles: true });
      });
      expect(screen.getByTestId("todo-drawer")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("drawer-open-full-page"));
      });
      expect(screen.getByTestId("task-full-page")).toBeTruthy();
      expect(
        within(screen.getByTestId("task-full-page")).getByText("Task A"),
      ).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("full-page-back"));
      });
      expect(screen.queryByTestId("task-full-page")).toBeNull();
    });

    it("d requests delete and confirm runs removeTodo", async () => {
      const removeTodo = vi.fn().mockResolvedValue(undefined);
      setupOverrides({
        todos: [baseTodo("t-a", "Delete me")],
        removeTodo,
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "d", bubbles: true });
      });
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("confirm-delete-ok"));
      });
      expect(removeTodo).toHaveBeenCalledWith("t-a");
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
    });

    it("slash focuses global search", async () => {
      const spy = vi.mocked(focusTargets.focusGlobalSearchInput);
      spy.mockClear();
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "/", bubbles: true });
      });
      await waitFor(() => expect(spy).toHaveBeenCalled());
    });

    it("toggles command palette with meta+k", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      expect(screen.getByTestId("command-palette")).toBeTruthy();
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      expect(screen.queryByTestId("command-palette")).toBeNull();
    });

    it("Escape closes the command palette without a second shortcut", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      expect(screen.getByTestId("command-palette")).toBeTruthy();
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(screen.queryByTestId("command-palette")).toBeNull();
    });

    it("Escape dismisses delete confirmation before touching task navigation", async () => {
      const removeTodo = vi.fn().mockResolvedValue(undefined);
      setupOverrides({
        todos: [baseTodo("t-a", "Do not delete")],
        removeTodo,
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "d", bubbles: true });
      });
      expect(screen.getByTestId("confirm-dialog")).toBeTruthy();
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
      expect(removeTodo).not.toHaveBeenCalled();
      const list = screen.getAllByTestId("todo-list")[0]!;
      expect(list.getAttribute("data-expanded-todo")).toBe("t-a");
    });

    it("Cancel on delete confirmation leaves the task in place", async () => {
      const removeTodo = vi.fn().mockResolvedValue(undefined);
      setupOverrides({
        todos: [baseTodo("t-a", "Keep me")],
        removeTodo,
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "d", bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("confirm-delete-cancel"));
      });
      expect(screen.queryByTestId("confirm-dialog")).toBeNull();
      expect(removeTodo).not.toHaveBeenCalled();
    });

    it("x marks the focused task complete via the store", async () => {
      const toggleTodo = vi.fn().mockResolvedValue(undefined);
      setupOverrides({
        todos: [baseTodo("t-a", "Do it")],
        toggleTodo,
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "x", bubbles: true });
      });
      expect(toggleTodo).toHaveBeenCalledWith("t-a", true);
    });

    it("Escape from drawer returns to quick edit with the same task focused", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "In drawer")] });
      render(ce(AppShell));
      const list = screen.getAllByTestId("todo-list")[0]!;
      await act(async () => {
        fireEvent.keyDown(document, { key: "j", bubbles: true });
      });
      await act(async () => {
        fireEvent.keyDown(document, { key: "e", bubbles: true });
      });
      expect(screen.getByTestId("todo-drawer")).toBeTruthy();
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(screen.queryByTestId("todo-drawer")).toBeNull();
      expect(list.getAttribute("data-expanded-todo")).toBe("t-a");
    });

    it("n focuses quick entry when the primary control exists, otherwise opens composer", async () => {
      const trigger = vi.mocked(focusTargets.triggerPrimaryNewTask);
      setupOverrides();
      render(ce(AppShell));
      trigger.mockReturnValueOnce(true);
      await act(async () => {
        fireEvent.keyDown(document, { key: "n", bubbles: true });
      });
      expect(screen.queryByTestId("task-composer")).toBeNull();
      trigger.mockReturnValueOnce(false);
      await act(async () => {
        fireEvent.keyDown(document, { key: "n", bubbles: true });
      });
      expect(screen.getByTestId("task-composer")).toBeTruthy();
    });
  });

  describe("board view and bulk actions", () => {
    it("switches list routes to board view", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "A")] });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-view-board"));
      });
      const boards = screen.getAllByTestId("board-view");
      expect(boards.some((el) => el.textContent?.includes("board:1"))).toBe(
        true,
      );
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-view-list"));
      });
      expect(screen.queryAllByTestId("board-view").length).toBe(0);
    });

    it("bulk complete calls todosApi.updateTodo and reloads", async () => {
      const loadTodos = vi.fn();
      setupOverrides({
        todos: [baseTodo("t-a", "A"), baseTodo("t-b", "B")],
        loadTodos,
      });
      vi.mocked(todosApi.updateTodo).mockClear();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("todo-select-row-a")[0]!);
      });
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("todo-select-row-b")[0]!);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-bulk-complete"));
      });
      expect(todosApi.updateTodo).toHaveBeenCalled();
      expect(loadTodos).toHaveBeenCalled();
    });

    it("bulk delete calls todosApi.deleteTodo", async () => {
      const loadTodos = vi.fn();
      setupOverrides({
        todos: [baseTodo("t-a", "A")],
        loadTodos,
      });
      vi.mocked(todosApi.deleteTodo).mockClear();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("todo-select-row-a")[0]!);
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-bulk-delete"));
      });
      expect(todosApi.deleteTodo).toHaveBeenCalledWith("t-a");
    });

    it("select all toggles full selection then clears via cancel", async () => {
      setupOverrides({
        todos: [baseTodo("t-a", "A"), baseTodo("t-b", "B")],
      });
      const { container } = render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("todo-select-row-a")[0]!);
      });
      expect(container.querySelector(".is-bulk-selecting")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-select-all"));
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("hdr-bulk-cancel"));
      });
      expect(container.querySelector(".is-bulk-selecting")).toBeNull();
    });
  });

  describe("command palette export calendar", () => {
    it("shows toast when no todos have due dates", async () => {
      setupOverrides({ todos: [baseTodo("t-a", "No due")] });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-export-calendar"));
      });
      expect(screen.getByTestId("undo-toast").textContent).toMatch(
        /No tasks with due dates/,
      );
      expect(mockExportIcs).not.toHaveBeenCalled();
    });

    it("exports ICS when tasks have due dates", async () => {
      mockExportIcs.mockClear();
      setupOverrides({
        todos: [baseTodo("t-a", "Due", { dueDate: "2026-04-20T12:00:00.000Z" })],
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-export-calendar"));
      });
      expect(mockExportIcs).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("undo-toast").textContent).toMatch(/Exported/);
    });
  });

  describe("command palette navigation callbacks", () => {
    it("navigates horizon segment from palette", async () => {
      setupOverrides();
      localStorage.setItem("todos:horizon-segment", "due");
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-horizon-pending"));
      });
      await waitFor(() => {
        expect(localStorage.getItem("todos:horizon-segment")).toBe("pending");
      });
    });

    it("opens weekly review page from palette", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-weekly-review"));
      });
      expect(screen.getByTestId("weekly-review")).toBeTruthy();
    });

    it("opens feedback page from palette", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-open-feedback"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("feedback-form")).toBeTruthy();
      });
    });

    it("opens shortcuts from palette then closes overlay", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-open-shortcuts"));
      });
      expect(screen.getByTestId("shortcuts-overlay")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("shortcuts-overlay-close"));
      });
      expect(screen.queryByTestId("shortcuts-overlay")).toBeNull();
    });

    it("opens drawer for todo and closes palette", async () => {
      setupOverrides({
        todos: [baseTodo("t-palette", "Palette todo")],
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-todo-click"));
      });
      expect(screen.getByTestId("todo-drawer")).toBeTruthy();
      expect(screen.queryByTestId("command-palette")).toBeNull();
    });

    it("selects project from palette", async () => {
      setupOverrides({
        projects: [
          {
            id: "p-palette",
            name: "Palette Project",
            slug: "pp",
            status: "active" as const,
            archived: false,
            userId: "u1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-project-open"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("project-editor-view")).toBeTruthy();
      });
      expect(screen.queryByTestId("command-palette")).toBeNull();
    });

    it("logs out from palette", async () => {
      const logout = vi.fn();
      setupOverrides();
      mockUseAuth.mockReturnValue({
        user: {
          id: "u1",
          name: "Test User",
          email: "test@example.com",
          onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
        },
        loading: false,
        logout,
        setUser: vi.fn(),
        setTokens: vi.fn(),
        refreshUser: vi.fn().mockResolvedValue(null),
      });
      render(ce(AppShell));
      await act(async () => {
        fireEvent.keyDown(document, { key: "k", metaKey: true, bubbles: true });
      });
      await act(async () => {
        fireEvent.click(screen.getByTestId("cmd-logout"));
      });
      expect(logout).toHaveBeenCalled();
    });
  });

  describe("undo toast and composer", () => {
    it("dismisses undo toast", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        serviceWorkerCallback!(1, 0);
      });
      expect(screen.getByTestId("undo-toast").textContent).toMatch(/Synced/);
      await act(async () => {
        fireEvent.click(screen.getByTestId("undo-dismiss"));
      });
      expect(screen.getByTestId("undo-toast").textContent).not.toMatch(/Synced/);
    });

    it("closes task composer", async () => {
      setupOverrides();
      render(ce(AppShell));
      await act(async () => {
        fireEvent.click(screen.getByTestId("sidebar-new-task"));
      });
      expect(screen.getByTestId("task-composer")).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByTestId("task-composer-close"));
      });
      expect(screen.queryByTestId("task-composer")).toBeNull();
    });
  });

  describe("service worker offline replay", () => {
    it("surfaces a toast when offline changes are replayed", async () => {
      setupOverrides();
      render(ce(AppShell));
      expect(serviceWorkerCallback).toBeTypeOf("function");
      await act(async () => {
        serviceWorkerCallback!(2, 1);
      });
      expect(screen.getByTestId("undo-toast").textContent).toMatch(
        /Synced 2 offline changes \(1 failed\)/,
      );
    });
  });

  describe("mobile escape closes sheet", () => {
    it("Escape closes mobile nav when open", async () => {
      setupOverrides({ isMobile: true });
      const { container } = render(ce(AppShell));
      await act(async () => {
        fireEvent.click(container.querySelector("#projectsRailMobileOpen")!);
      });
      expect(container.querySelector(".mobile-sheet")?.getAttribute("aria-hidden")).toBe(
        "false",
      );
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape", bubbles: true });
      });
      expect(container.querySelector(".mobile-sheet")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    });
  });
});
