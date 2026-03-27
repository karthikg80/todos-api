// =============================================================================
// commandPalette.js — Cmd+K command palette: open, close, render, execute.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { getAllProjects } from "./projectsState.js";
import { setSelectedProjectKey } from "./filterLogic.js";
import { applyUiAction } from "./stateActions.js";
import { toggleShortcuts, closeShortcutsOverlay } from "./shortcuts.js";
import { illustrationCommandEmpty } from "../utils/illustrations.js";

function getCommandPaletteElements() {
  const overlay = document.getElementById("commandPaletteOverlay");
  const panel = document.getElementById("commandPalettePanel");
  const input = document.getElementById("commandPaletteInput");
  const list = document.getElementById("commandPaletteList");
  const empty = document.getElementById("commandPaletteEmpty");
  const title = document.getElementById("commandPaletteTitle");
  if (!(overlay instanceof HTMLElement)) return null;
  if (!(panel instanceof HTMLElement)) return null;
  if (!(input instanceof HTMLInputElement)) return null;
  if (!(list instanceof HTMLElement)) return null;
  if (!(empty instanceof HTMLElement)) return null;
  if (!(title instanceof HTMLElement)) return null;
  return { overlay, panel, input, list, empty, title };
}

function buildCommandPaletteItems() {
  const baseItems = [
    // --- Task Actions ---
    {
      id: "add-task",
      label: "Create task",
      type: "action",
      payload: "add-task",
    },
    // --- Navigation ---
    {
      id: "nav-home",
      label: "Go to Home",
      type: "workspace",
      payload: "home",
    },
    {
      id: "nav-inbox",
      label: "Go to Desk",
      type: "workspace",
      payload: "inbox",
    },
    {
      id: "nav-today",
      label: "Go to Today",
      type: "workspace",
      payload: "today",
    },
    {
      id: "nav-upcoming",
      label: "Go to Upcoming",
      type: "workspace",
      payload: "upcoming",
    },
    {
      id: "all-tasks",
      label: "Go to All tasks",
      type: "project",
      payload: "",
    },
    {
      id: "nav-unsorted",
      label: "Go to Unsorted",
      type: "workspace",
      payload: "unsorted",
    },
    {
      id: "nav-waiting",
      label: "Go to Waiting",
      type: "workspace",
      payload: "waiting",
    },
    {
      id: "nav-scheduled",
      label: "Go to Scheduled",
      type: "workspace",
      payload: "scheduled",
    },
    {
      id: "nav-someday",
      label: "Go to Someday",
      type: "workspace",
      payload: "someday",
    },
    {
      id: "nav-completed",
      label: "Go to Completed",
      type: "workspace",
      payload: "completed",
    },
    {
      id: "nav-weekly-review",
      label: "Go to Weekly Review",
      type: "workspace",
      payload: "weekly-review",
    },
    {
      id: "nav-cleanup",
      label: "Go to Cleanup",
      type: "workspace",
      payload: "cleanup",
    },
    {
      id: "nav-feedback",
      label: "Go to Feedback",
      type: "view",
      payload: "feedback",
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      type: "view",
      payload: "settings",
    },
    // --- Workflow Triggers ---
    {
      id: "workflow-plan-today",
      label: "Plan Today",
      type: "action",
      payload: "plan-today",
    },
    {
      id: "workflow-weekly-review",
      label: "Run Weekly Review",
      type: "action",
      payload: "run-weekly-review",
    },
    {
      id: "workflow-ai-workspace",
      label: "Open AI Workspace",
      type: "action",
      payload: "open-ai-workspace",
    },
    {
      id: "workflow-refresh-priorities",
      label: "Refresh Priorities",
      type: "action",
      payload: "refresh-priorities",
    },
    // --- System ---
    {
      id: "sys-dark-mode",
      label: "Toggle Dark Mode",
      type: "action",
      payload: "toggle-theme",
    },
    {
      id: "sys-shortcuts",
      label: "Show Keyboard Shortcuts",
      type: "action",
      payload: "show-shortcuts",
    },
    {
      id: "sys-export-calendar",
      label: "Export Calendar",
      type: "action",
      payload: "export-calendar",
    },
  ];

  const projectItems = getAllProjects().map((projectName) => ({
    id: `project-${projectName}`,
    label: `Go to project: ${hooks.getProjectLeafName(projectName)}`,
    type: "project",
    payload: projectName,
  }));

  return [...baseItems, ...projectItems];
}

function getCommandPaletteCommandMatches(query) {
  if (!query) {
    return state.commandPaletteItems;
  }
  return state.commandPaletteItems.filter((item) =>
    item.label.toLowerCase().includes(query),
  );
}

function getCommandPaletteTaskMatches(query) {
  if (!query) {
    return [];
  }

  const normalizedQuery = query.toLowerCase();
  const ranked = state.todos
    .map((todo) => {
      const title = String(todo.title || "");
      const description = String(todo.description || "");
      const titleLower = title.toLowerCase();
      const descriptionLower = description.toLowerCase();

      let score = -1;
      if (titleLower.startsWith(normalizedQuery)) {
        score = 0;
      } else if (titleLower.includes(normalizedQuery)) {
        score = 1;
      } else if (descriptionLower.includes(normalizedQuery)) {
        score = 2;
      }

      if (score === -1) return null;

      const dueAt = todo.dueDate ? new Date(todo.dueDate).getTime() : Infinity;
      const now = new Date();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );
      let dueState = "";
      if (todo.dueDate) {
        const due = new Date(todo.dueDate);
        if (due < now) dueState = "overdue";
        else if (due <= todayEnd) dueState = "today";
        else dueState = "upcoming";
      }
      const statusLabel = todo.status || "";
      const projectName = todo.category
        ? hooks.getProjectLeafName
          ? hooks.getProjectLeafName(todo.category)
          : todo.category
        : "";
      return {
        id: `task-${todo.id}`,
        type: "task",
        todoId: String(todo.id),
        label: title,
        score,
        dueAt: Number.isFinite(dueAt) ? dueAt : Infinity,
        completed: !!todo.completed,
        status: statusLabel,
        dueState,
        projectName,
        meta: [
          statusLabel && statusLabel !== "next"
            ? statusLabel.replace("_", " ")
            : "",
          projectName || "",
          dueState === "overdue"
            ? "Overdue"
            : dueState === "today"
              ? "Due today"
              : todo.dueDate
                ? `Due ${new Date(todo.dueDate).toLocaleDateString()}`
                : "",
        ]
          .filter(Boolean)
          .join(" \u00b7 "),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
      const titleCompare = a.label.localeCompare(b.label);
      if (titleCompare !== 0) return titleCompare;
      return a.todoId.localeCompare(b.todoId);
    });

  return ranked.slice(0, 6);
}

function getCommandPaletteRenderModel() {
  const query = state.commandPaletteQuery.trim().toLowerCase();
  const commandMatches = getCommandPaletteCommandMatches(query);
  const taskMatches = getCommandPaletteTaskMatches(query);
  const rows = [];

  if (commandMatches.length > 0) {
    rows.push({
      kind: "section",
      id: "commands-section",
      label: "Commands",
    });
    commandMatches.forEach((item) => {
      rows.push({ kind: "item", item });
    });
  }

  if (query) {
    rows.push({
      kind: "section",
      id: "tasks-section",
      label: "Tasks",
    });
    if (taskMatches.length === 0) {
      rows.push({
        kind: "empty",
        id: "tasks-empty",
        label: "No tasks found",
      });
    } else {
      taskMatches.forEach((item) => {
        rows.push({ kind: "item", item });
      });
    }
  }

  const selectableItems = rows
    .filter((row) => row.kind === "item")
    .map((row) => row.item);

  const hasAnyResults =
    commandMatches.length > 0 || (!!query && taskMatches.length > 0);
  return { rows, selectableItems, hasAnyResults };
}

function renderCommandPalette() {
  const refs = getCommandPaletteElements();
  if (!refs) return;

  refs.overlay.classList.toggle(
    "command-palette-overlay--open",
    state.isCommandPaletteOpen,
  );
  refs.overlay.setAttribute("aria-hidden", String(!state.isCommandPaletteOpen));
  refs.input.value = state.commandPaletteQuery;

  const renderModel = getCommandPaletteRenderModel();
  state.commandPaletteSelectableItems = renderModel.selectableItems;
  if (state.commandPaletteSelectableItems.length === 0) {
    state.commandPaletteIndex = 0;
  } else if (
    state.commandPaletteIndex >
    state.commandPaletteSelectableItems.length - 1
  ) {
    state.commandPaletteIndex = state.commandPaletteSelectableItems.length - 1;
  }

  refs.input.setAttribute("aria-expanded", String(state.isCommandPaletteOpen));
  refs.input.setAttribute(
    "aria-activedescendant",
    state.commandPaletteSelectableItems.length > 0
      ? `commandPaletteOption-${state.commandPaletteIndex}`
      : "",
  );

  let selectableIndex = -1;
  refs.list.innerHTML = renderModel.rows
    .map((row) => {
      if (row.kind === "section") {
        return `<div class="command-palette-section" role="presentation">${hooks.escapeHtml(row.label)}</div>`;
      }
      if (row.kind === "empty") {
        return `<div class="command-palette-inline-empty" role="status">${illustrationCommandEmpty()}${hooks.escapeHtml(row.label)}</div>`;
      }

      selectableIndex += 1;
      const isActive = selectableIndex === state.commandPaletteIndex;
      const item = row.item;
      if (item.type === "task") {
        const badges = [];
        if (item.dueState === "overdue")
          badges.push(
            '<span class="command-palette-badge command-palette-badge--overdue">Overdue</span>',
          );
        else if (item.dueState === "today")
          badges.push(
            '<span class="command-palette-badge command-palette-badge--today">Today</span>',
          );
        if (
          item.status &&
          item.status !== "next" &&
          item.status !== "done" &&
          item.status !== "cancelled"
        )
          badges.push(
            `<span class="command-palette-badge">${hooks.escapeHtml(item.status.replace("_", " "))}</span>`,
          );
        return `
          <button
            type="button"
            id="commandPaletteOption-${selectableIndex}"
            class="command-palette-option command-palette-option--task ${isActive ? "command-palette-option--active" : ""} ${item.completed ? "command-palette-option--completed" : ""}"
            role="option"
            aria-selected="${isActive ? "true" : "false"}"
            data-command-index="${selectableIndex}"
            data-command-id="${hooks.escapeHtml(item.id)}"
          >
            <span class="command-palette-option__title">${hooks.escapeHtml(item.label)}${badges.length ? " " + badges.join("") : ""}</span>
            <span class="command-palette-option__meta">${hooks.escapeHtml(item.projectName || "")}${item.meta && item.projectName ? " \u00b7 " : ""}${hooks.escapeHtml(
              item.meta && !item.projectName
                ? item.meta
                : item.meta
                    ?.replace(item.projectName, "")
                    .replace(/^ \u00b7 /, "")
                    .replace(/ \u00b7 $/, "") ||
                    (item.completed ? "Completed" : ""),
            )}</span>
          </button>
        `;
      }

      return `
        <button
          type="button"
          id="commandPaletteOption-${selectableIndex}"
          class="command-palette-option ${isActive ? "command-palette-option--active" : ""}"
          role="option"
          aria-selected="${isActive ? "true" : "false"}"
          data-command-index="${selectableIndex}"
          data-command-id="${hooks.escapeHtml(item.id)}"
        >
          ${hooks.escapeHtml(item.label)}
        </button>
      `;
    })
    .join("");

  refs.empty.hidden = renderModel.hasAnyResults;
}

function ensureTodosViewActive() {
  const todosView = document.getElementById("todosView");
  const shouldSwitchToTodos =
    !(todosView instanceof HTMLElement) ||
    !todosView.classList.contains("active") ||
    todosView.classList.contains("todos-view--settings-active");

  if (shouldSwitchToTodos) {
    const todosTab = document.querySelector(
      ".nav-tab[data-onclick*=\"switchView('todos'\"]",
    );
    hooks.switchView(
      "todos",
      todosTab instanceof HTMLElement ? todosTab : null,
    );
  }
}

function executeCommandPaletteItem(item, triggerEl = null) {
  if (!item) return;

  if (item.type === "action") {
    switch (item.payload) {
      case "add-task":
        ensureTodosViewActive();
        closeCommandPalette({ restoreFocus: false });
        window.requestAnimationFrame(() => {
          hooks.openTaskComposer(triggerEl);
        });
        return;
      case "plan-today":
        ensureTodosViewActive();
        closeCommandPalette({ restoreFocus: false });
        hooks.selectWorkspaceView?.("home", triggerEl);
        window.requestAnimationFrame(() => {
          hooks.triggerPlanToday?.();
        });
        return;
      case "run-weekly-review":
        ensureTodosViewActive();
        closeCommandPalette({ restoreFocus: false });
        hooks.selectWorkspaceView?.("weekly-review", triggerEl);
        return;
      case "open-ai-workspace":
        ensureTodosViewActive();
        closeCommandPalette({ restoreFocus: false });
        window.requestAnimationFrame(() => {
          hooks.toggleAiWorkspace?.();
        });
        return;
      case "refresh-priorities":
        closeCommandPalette({ restoreFocus: false });
        hooks.refreshHomeFocus?.();
        return;
      case "toggle-theme":
        closeCommandPalette({ restoreFocus: false });
        window.toggleTheme?.();
        return;
      case "show-shortcuts":
        closeCommandPalette({ restoreFocus: false });
        toggleShortcuts();
        return;
      case "export-calendar":
        closeCommandPalette({ restoreFocus: false });
        hooks.exportCalendar?.();
        return;
      default:
        break;
    }
  }

  if (item.type === "workspace") {
    ensureTodosViewActive();
    closeCommandPalette({ restoreFocus: false });
    hooks.selectWorkspaceView?.(String(item.payload), triggerEl);
    return;
  }

  if (item.type === "view") {
    closeCommandPalette({ restoreFocus: false });
    hooks.switchView(String(item.payload), triggerEl);
    return;
  }

  if (item.type === "project") {
    ensureTodosViewActive();
    setSelectedProjectKey(String(item.payload || ""));
    closeCommandPalette({ restoreFocus: false });
    return;
  }

  if (item.type === "task") {
    ensureTodosViewActive();
    closeCommandPalette({ restoreFocus: false });
    window.requestAnimationFrame(() => {
      hooks.openTodoDrawer(
        item.todoId,
        triggerEl instanceof HTMLElement ? triggerEl : null,
      );
    });
  }
}

function moveCommandPaletteSelection(delta) {
  const visibleCount = state.commandPaletteSelectableItems.length;
  if (visibleCount === 0) {
    state.commandPaletteIndex = 0;
    renderCommandPalette();
    return;
  }
  state.commandPaletteIndex =
    (state.commandPaletteIndex + delta + visibleCount) % visibleCount;
  renderCommandPalette();
}

function closeCommandPalette({ restoreFocus = true } = {}) {
  if (!state.isCommandPaletteOpen) return;
  const focusTarget = state.lastFocusedBeforePalette;
  applyUiAction("commandPalette/close");
  renderCommandPalette();
  hooks.DialogManager.close("commandPalette");

  if (restoreFocus && focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
  }
}

function openCommandPalette() {
  if (!state.currentUser) return;

  const refs = getCommandPaletteElements();
  if (!refs) return;
  if (state.isCommandPaletteOpen) return;

  applyUiAction("commandPalette/open", {
    opener: document.activeElement,
    items: buildCommandPaletteItems(),
  });
  renderCommandPalette();
  hooks.DialogManager.open("commandPalette", refs.overlay, {
    onEscape: () => closeCommandPalette({ restoreFocus: true }),
    backdrop: false,
  });

  window.requestAnimationFrame(() => {
    refs.input.focus();
    refs.input.select();
  });
}

function toggleCommandPalette() {
  if (state.isCommandPaletteOpen) {
    closeCommandPalette({ restoreFocus: true });
    return;
  }
  openCommandPalette();
}

function bindCommandPaletteHandlers() {
  if (window.__commandPaletteHandlersBound) {
    return;
  }
  window.__commandPaletteHandlersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const overlay = target.closest("#commandPaletteOverlay");
    if (
      overlay instanceof HTMLElement &&
      target.id === "commandPaletteOverlay"
    ) {
      closeCommandPalette({ restoreFocus: true });
      return;
    }

    if (!state.isCommandPaletteOpen) return;

    const option = target.closest("[data-command-id]");
    if (!(option instanceof HTMLElement)) return;
    event.preventDefault();
    const itemIndex = Number.parseInt(
      option.getAttribute("data-command-index") || "-1",
      10,
    );
    if (itemIndex < 0) return;
    executeCommandPaletteItem(
      state.commandPaletteSelectableItems[itemIndex],
      option,
    );
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id !== "commandPaletteInput") return;
    applyUiAction("commandPalette/query:set", {
      query:
        target instanceof HTMLInputElement
          ? target.value
          : String(target.value),
    });
    renderCommandPalette();
  });
}

export {
  getCommandPaletteElements,
  buildCommandPaletteItems,
  getCommandPaletteCommandMatches,
  getCommandPaletteTaskMatches,
  getCommandPaletteRenderModel,
  renderCommandPalette,
  executeCommandPaletteItem,
  moveCommandPaletteSelection,
  closeCommandPalette,
  openCommandPalette,
  toggleCommandPalette,
  bindCommandPaletteHandlers,
};
