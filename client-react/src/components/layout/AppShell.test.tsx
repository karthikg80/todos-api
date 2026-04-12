// @vitest-environment jsdom
// @ts-nocheck — heavy mocking of AppShell's many dependencies
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// ─── Mock all heavy dependencies before importing AppShell ──────────

vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Test User", email: "test@example.com", isVerified: true },
    logout: vi.fn(),
  }),
}));

vi.mock("../../store/useTodosStore", () => ({
  useTodosStore: () => ({
    todos: [],
    loadState: "loaded",
    errorMessage: null,
    loadTodos: vi.fn(),
    addTodo: vi.fn(),
    toggleTodo: vi.fn(),
    editTodo: vi.fn(),
    removeTodo: vi.fn(),
  }),
}));

vi.mock("../../store/useProjectsStore", () => ({
  useProjectsStore: () => ({
    projects: [],
    loadProjects: vi.fn(),
  }),
}));

vi.mock("../../hooks/useDarkMode", () => ({
  useDarkMode: () => ({ dark: false, toggle: vi.fn() }),
}));

vi.mock("../../hooks/useDensity", () => ({
  useDensity: () => ({ density: "comfortable", setDensity: vi.fn(), cycle: vi.fn() }),
}));

vi.mock("../../hooks/useGroupBy", () => ({
  useGroupBy: () => ({ groupBy: "none", setGroupBy: vi.fn() }),
}));

vi.mock("../../hooks/useServiceWorker", () => ({
  useServiceWorker: () => vi.fn(),
}));

vi.mock("../../hooks/useIsMobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("../../hooks/useIcsExport", () => ({
  useIcsExport: () => ({ exportIcs: vi.fn() }),
}));

vi.mock("../../hooks/useTaskNavigation", () => ({
  useTaskNavigation: () => ({
    state: { mode: "collapsed" },
    activeTaskId: null,
    openQuickEdit: vi.fn(),
    openDrawer: vi.fn(),
    openFullPage: vi.fn(),
    escalate: vi.fn(),
    deescalate: vi.fn(),
    collapse: vi.fn(),
  }),
}));

vi.mock("../../hooks/useHashRoute", () => ({
  useHashRoute: () => ({ hashRoute: { taskId: null } }),
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
}));

// Mock child components to avoid rendering their full trees
vi.mock("../projects/Sidebar", () => ({
  Sidebar: ({ onBack, onCreateProject, onOpenSettings, onOpenActivity, onToggleTheme, onOpenShortcuts, onLogout, user, dark, onNewTask, onSearchChange, searchQuery }: any) =>
    React.createElement("aside", { "data-testid": "sidebar" },
      React.createElement("button", { "data-testid": "sidebar-new-task", onClick: onNewTask }, "New Task"),
      React.createElement("button", { "data-testid": "sidebar-settings", onClick: onOpenSettings }, "Settings"),
      React.createElement("button", { "data-testid": "sidebar-activity", onClick: onOpenActivity }, "Activity"),
      React.createElement("button", { "data-testid": "sidebar-dark-mode", onClick: onToggleTheme }, "Dark Mode"),
      React.createElement("button", { "data-testid": "sidebar-shortcuts", onClick: onOpenShortcuts }, "Shortcuts"),
      React.createElement("button", { "data-testid": "sidebar-logout", onClick: onLogout }, "Logout"),
      React.createElement("input", { "data-testid": "sidebar-search", value: searchQuery || "", onChange: (e: any) => onSearchChange?.(e.target.value) }),
    ),
}));

vi.mock("../todos/SortableTodoList", () => ({
  SortableTodoList: () => React.createElement("div", { "data-testid": "todo-list" }),
}));

vi.mock("../todos/TodoDrawer", () => ({
  TodoDrawer: () => null,
}));

vi.mock("../shared/UndoToast", () => ({
  UndoToast: () => React.createElement("div", { "data-testid": "undo-toast" }),
}));

vi.mock("../shared/ConfirmDialog", () => ({
  ConfirmDialog: () => null,
}));

vi.mock("../shared/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("../shared/ShortcutsOverlay", () => ({
  ShortcutsOverlay: () => null,
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
  ListViewHeader: () => React.createElement("div", { "data-testid": "list-header" }),
}));

vi.mock("../../utils/focusTargets", () => ({
  focusGlobalSearchInput: vi.fn(),
  triggerPrimaryNewTask: vi.fn(),
}));

vi.mock("../shared/OnboardingFlow", () => ({
  OnboardingFlow: () => null,
}));

vi.mock("../todos/TaskFullPage", () => ({
  TaskFullPage: () => null,
}));

import { AppShell } from "./AppShell";

const { createElement: ce } = React;

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders the app shell container", () => {
    const { container } = render(ce(AppShell));
    // The root element has class "app-shell"
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

  it("renders the home dashboard by default", () => {
    render(ce(AppShell));
    expect(screen.getByTestId("home-dashboard")).toBeTruthy();
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
