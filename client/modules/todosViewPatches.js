// =============================================================================
// todosViewPatches.js — Fine-grained DOM patches for stable todo list surfaces.
// These helpers intentionally avoid changing list membership; callers must fall
// back to the canonical filter/render pipeline when visibility may change.
// =============================================================================

import { state, hooks } from "./store.js";
import { getVisibleTodos } from "./filterLogic.js";

const DomSelectors = window.DomSelectors || {};

function escapeSelectorValue(value) {
  if (DomSelectors.escapeSelectorValue) {
    return DomSelectors.escapeSelectorValue(value);
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
}

function getTodoRow(todoId) {
  if (DomSelectors.getTodoRowElement) {
    return DomSelectors.getTodoRowElement(todoId);
  }
  return document.querySelector(
    `.todos-list [data-todo-id="${escapeSelectorValue(todoId)}"]`,
  );
}

function getTodoCheckboxes(todoId) {
  if (DomSelectors.getTodoRowCheckboxes) {
    return DomSelectors.getTodoRowCheckboxes(todoId);
  }
  const row = getTodoRow(todoId);
  if (!(row instanceof HTMLElement)) {
    return { bulk: null, completed: null };
  }
  return {
    bulk: row.querySelector(".bulk-checkbox"),
    completed: row.querySelector(".todo-checkbox"),
  };
}

function getTodoKebabElements(todoId) {
  if (DomSelectors.getTodoKebabElements) {
    return DomSelectors.getTodoKebabElements(todoId);
  }
  const row = getTodoRow(todoId);
  if (!(row instanceof HTMLElement)) {
    return { trigger: null, menu: null };
  }
  return {
    trigger: row.querySelector(".todo-kebab"),
    menu: row.querySelector(".todo-kebab-menu"),
  };
}

function normalizeProjectPath(value) {
  return hooks.normalizeProjectPath
    ? hooks.normalizeProjectPath(value)
    : String(value || "");
}

function isTodoUnsorted(todo) {
  return !normalizeProjectPath(todo?.category || "");
}

function getOpenTodoCountMapByProject() {
  const map = new Map();

  state.todos.forEach((todo) => {
    if (todo?.completed) return;
    const todoProject = normalizeProjectPath(todo?.category || "");
    if (!todoProject) return;

    const segments = todoProject
      .split(hooks.PROJECT_PATH_SEPARATOR)
      .filter(Boolean);
    let prefix = "";
    segments.forEach((segment) => {
      prefix = prefix
        ? `${prefix}${hooks.PROJECT_PATH_SEPARATOR}${segment}`
        : segment;
      map.set(prefix, (map.get(prefix) || 0) + 1);
    });
  });

  return map;
}

function buildNotesSectionHtml(todo) {
  const notes = String(todo?.notes || "").trim();
  if (!notes) return "";
  const escapeHtml = hooks.escapeHtml || ((value) => value);
  return `
    <div class="notes-section">
      <button class="notes-toggle" data-onclick="toggleNotes('${todo.id}', event)">
        <span class="expand-icon" id="notes-icon-${todo.id}">▶</span>
        <span>📝 Notes</span>
      </button>
      <div class="notes-content" id="notes-content-${todo.id}" style="display: none;">
        ${escapeHtml(notes)}
      </div>
    </div>
  `;
}

function getCategoryStatsMap(visibleTodos) {
  const statsMap = new Map();
  visibleTodos.forEach((todo) => {
    const categoryKey = String(todo?.category || "Uncategorized");
    const stats = statsMap.get(categoryKey) || { total: 0, done: 0 };
    stats.total += 1;
    if (todo?.completed) {
      stats.done += 1;
    }
    statsMap.set(categoryKey, stats);
  });
  return statsMap;
}

export function hasTodoRow(todoId) {
  return getTodoRow(todoId) instanceof HTMLElement;
}

export function patchTodoCompleted(todoId, completed) {
  const row = getTodoRow(todoId);
  if (!(row instanceof HTMLElement)) return;
  row.classList.toggle("completed", !!completed);
  const { completed: completedCheckbox } = getTodoCheckboxes(todoId);
  if (completedCheckbox instanceof HTMLInputElement) {
    completedCheckbox.checked = !!completed;
  }
}

export function patchTodoBulkSelected(todoId, selected) {
  const row = getTodoRow(todoId);
  if (!(row instanceof HTMLElement)) return;
  row.classList.toggle("todo-item--bulk-selected", !!selected);
  const { bulk } = getTodoCheckboxes(todoId);
  if (bulk instanceof HTMLInputElement) {
    bulk.checked = !!selected;
  }
}

export function patchSelectedTodoRowActiveState() {
  document
    .querySelectorAll(".todos-list .todo-item.todo-item--active")
    .forEach((row) => row.classList.remove("todo-item--active"));

  if (!state.selectedTodoId) return;
  const row = getTodoRow(state.selectedTodoId);
  if (row instanceof HTMLElement) {
    row.classList.add("todo-item--active");
  }
}

export function patchTodoKebabState() {
  document.querySelectorAll(".todo-kebab").forEach((button) => {
    if (button instanceof HTMLElement) {
      button.setAttribute("aria-expanded", "false");
    }
  });
  document.querySelectorAll(".todo-kebab-menu").forEach((menu) => {
    if (menu instanceof HTMLElement) {
      menu.classList.remove("todo-kebab-menu--open");
    }
  });

  if (!state.openTodoKebabId) return;
  const { trigger, menu } = getTodoKebabElements(state.openTodoKebabId);
  if (trigger instanceof HTMLElement) {
    trigger.setAttribute("aria-expanded", "true");
  }
  if (menu instanceof HTMLElement) {
    menu.classList.add("todo-kebab-menu--open");
  }
}

export function patchTodoContentMetadata(todoId, updatedTodo) {
  const row = getTodoRow(todoId);
  if (!(row instanceof HTMLElement)) return;

  const todo =
    updatedTodo ||
    state.todos.find((item) => String(item.id) === String(todoId)) ||
    null;
  if (!todo) return;

  const titleEl = row.querySelector(".todo-title");
  if (titleEl instanceof HTMLElement) {
    const nextTitle = String(todo.title || "");
    titleEl.textContent = nextTitle;
    titleEl.setAttribute("title", nextTitle);
  }

  const contentEl = row.querySelector(".todo-content");
  const descriptionEl = row.querySelector(".todo-description");
  const nextDescription = String(todo.description || "").trim();
  if (descriptionEl instanceof HTMLElement && !nextDescription) {
    descriptionEl.remove();
  } else if (descriptionEl instanceof HTMLElement) {
    descriptionEl.textContent = nextDescription;
  } else if (contentEl instanceof HTMLElement && nextDescription) {
    const newDescription = document.createElement("div");
    newDescription.className = "todo-description";
    newDescription.textContent = nextDescription;
    const titleNode = contentEl.querySelector(".todo-title");
    if (titleNode?.nextSibling) {
      contentEl.insertBefore(newDescription, titleNode.nextSibling);
    } else {
      contentEl.appendChild(newDescription);
    }
  }

  const metaEl = row.querySelector(".todo-meta");
  if (metaEl instanceof HTMLElement && hooks.renderTodoChips) {
    const isOverdue =
      todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
    const dueDateStr = todo.dueDate
      ? new Date(todo.dueDate).toLocaleString()
      : "";
    metaEl.innerHTML =
      hooks.renderTodoChips(todo, { isOverdue, dueDateStr }) || "";
  }

  if (!(contentEl instanceof HTMLElement)) return;

  const notesSection = row.querySelector(".notes-section");
  const nextNotes = String(todo.notes || "").trim();
  if (!nextNotes && notesSection instanceof HTMLElement) {
    notesSection.remove();
    return;
  }

  if (!nextNotes) return;

  if (notesSection instanceof HTMLElement) {
    const notesContent = notesSection.querySelector(
      `#notes-content-${escapeSelectorValue(todo.id)}`,
    );
    if (notesContent instanceof HTMLElement) {
      notesContent.textContent = nextNotes;
    }
    return;
  }

  const html = buildNotesSectionHtml(todo);
  if (!html) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html.trim();
  const nextNotesSection = wrapper.firstElementChild;
  if (!(nextNotesSection instanceof HTMLElement)) return;

  const subtasksSection = contentEl.querySelector(".subtasks-section");
  const metaSection = contentEl.querySelector(".todo-meta");
  if (subtasksSection?.nextSibling) {
    contentEl.insertBefore(nextNotesSection, subtasksSection.nextSibling);
  } else if (subtasksSection instanceof HTMLElement) {
    contentEl.appendChild(nextNotesSection);
  } else if (metaSection?.nextSibling) {
    contentEl.insertBefore(nextNotesSection, metaSection.nextSibling);
  } else {
    contentEl.appendChild(nextNotesSection);
  }
}

export function patchTodoById(
  todoId,
  updatedTodo,
  { syncCompleted = true, syncContent = true } = {},
) {
  if (syncCompleted) {
    patchTodoCompleted(todoId, updatedTodo?.completed);
  }
  if (syncContent) {
    patchTodoContentMetadata(todoId, updatedTodo);
  }
}

export function patchHeaderCountsFromVisibleTodos(
  visibleTodos = getVisibleTodos(),
) {
  hooks.updateHeaderFromVisibleTodos?.(visibleTodos);
  hooks.updateIcsExportButtonState?.();
}

export function patchVisibleCategoryGroupStats(
  visibleTodos = getVisibleTodos(),
) {
  const selectedProject = hooks.getSelectedProjectKey?.();
  if (selectedProject) return;

  const statsMap = getCategoryStatsMap(visibleTodos);
  document
    .querySelectorAll(".todo-group-header[data-category-group-key]")
    .forEach((header) => {
      if (!(header instanceof HTMLElement)) return;
      const categoryKey = header.getAttribute("data-category-group-key") || "";
      const stats = statsMap.get(categoryKey) || { total: 0, done: 0 };
      const statsEl = header.querySelector("[data-category-group-stats]");
      if (statsEl instanceof HTMLElement) {
        statsEl.textContent = `${stats.done}/${stats.total} done`;
      }
    });
}

export function patchProjectsRailCounts() {
  if (typeof hooks.patchProjectsRailView === "function") {
    hooks.patchProjectsRailView();
    return;
  }

  const refs = DomSelectors.getRailElements
    ? DomSelectors.getRailElements()
    : {
        desktopList: document.getElementById("projectsRailList"),
        sheetList: document.getElementById("projectsRailSheetList"),
        desktopAllCount: null,
        desktopUnsortedCount: null,
        sheetAllCount: null,
        sheetUnsortedCount: null,
      };

  const openTodoCountMap = getOpenTodoCountMapByProject();
  const pendingTodos = state.todos.filter((todo) => !todo?.completed);
  const allCount = pendingTodos.length;
  const unsortedCount = pendingTodos.filter((todo) =>
    isTodoUnsorted(todo),
  ).length;

  [refs.desktopAllCount, refs.sheetAllCount].forEach((countEl) => {
    if (countEl instanceof HTMLElement) {
      countEl.textContent = String(allCount);
    }
  });
  [refs.desktopUnsortedCount, refs.sheetUnsortedCount].forEach((countEl) => {
    if (countEl instanceof HTMLElement) {
      countEl.textContent = String(unsortedCount);
    }
  });

  [refs.desktopList, refs.sheetList].forEach((root) => {
    if (!(root instanceof HTMLElement)) return;
    root
      .querySelectorAll(".projects-rail-item[data-project-key]")
      .forEach((button) => {
        if (!(button instanceof HTMLElement)) return;
        const projectKey = button.getAttribute("data-project-key") || "";
        const countEl = button.querySelector(".projects-rail-item__count");
        if (countEl instanceof HTMLElement) {
          countEl.textContent = String(openTodoCountMap.get(projectKey) || 0);
        }
      });
  });
}

export function patchBulkToolbar() {
  const refs = DomSelectors.getBulkToolbar
    ? DomSelectors.getBulkToolbar()
    : {
        toolbar: document.getElementById("bulkActionsToolbar"),
        selectAll: document.getElementById("selectAllCheckbox"),
        countLabel: document.getElementById("bulkCount"),
      };
  const selectedCount = state.selectedTodos.size;
  if (refs.toolbar instanceof HTMLElement) {
    refs.toolbar.style.display = selectedCount > 0 ? "flex" : "none";
  }
  if (refs.countLabel instanceof HTMLElement) {
    refs.countLabel.textContent = `${selectedCount} selected`;
  }

  const visibleTodos = hooks.getVisibleTodos?.() ?? getVisibleTodos();
  const allSelected =
    visibleTodos.length > 0 &&
    visibleTodos.every((todo) => state.selectedTodos.has(todo.id));
  if (refs.selectAll instanceof HTMLInputElement) {
    refs.selectAll.checked = allSelected;
  }
}

// ---------------------------------------------------------------------------
// Focus preservation — save/restore focus across DOM updates.
// ---------------------------------------------------------------------------

/**
 * Capture the currently focused element's identity so it can be restored
 * after a DOM rewrite. Returns a restore function.
 *
 * Usage:
 *   const restoreFocus = saveFocusState();
 *   // ... perform DOM update ...
 *   restoreFocus();
 *
 * @returns {() => void}
 */
export function saveFocusState() {
  const active = document.activeElement;
  if (!active || active === document.body) {
    return () => {};
  }

  const todoId =
    active.closest("[data-todo-id]")?.getAttribute("data-todo-id") || null;
  const tagName = active.tagName;
  const inputName =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.name || active.id
      : null;
  const selectionStart =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.selectionStart
      : null;
  const selectionEnd =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? active.selectionEnd
      : null;

  return () => {
    if (!todoId && !inputName) return;

    let target = null;
    if (todoId && inputName) {
      const row = getTodoRow(todoId);
      target = row?.querySelector(
        `${tagName}[name="${inputName}"], ${tagName}#${inputName}`,
      );
    } else if (inputName) {
      target =
        document.querySelector(
          `${tagName}[name="${inputName}"], ${tagName}#${inputName}`,
        ) || null;
    } else if (todoId) {
      const row = getTodoRow(todoId);
      target = row?.querySelector(tagName) || row;
    }

    if (target instanceof HTMLElement) {
      target.focus();
      if (
        selectionStart !== null &&
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement)
      ) {
        try {
          target.setSelectionRange(selectionStart, selectionEnd);
        } catch {
          // setSelectionRange not supported for some input types
        }
      }
    }
  };
}
