// domSelectors.js - Central DOM lookup helpers for hot paths.
// Exposed as window.DomSelectors, mirroring other utility modules.

(function initDomSelectors(globalScope) {
  function byId(id) {
    return document.getElementById(id);
  }

  function escapeSelectorValue(value) {
    const raw = String(value || "");
    if (globalScope.CSS && typeof globalScope.CSS.escape === "function") {
      return globalScope.CSS.escape(raw);
    }
    return raw.replace(/["\\]/g, "\\$&");
  }

  function getTodosContainer() {
    return byId("todosContent");
  }

  function getTodosScrollRegion() {
    return byId("todosScrollRegion");
  }

  function getTodosListHeader() {
    return {
      root: byId("todosListHeader"),
      title: byId("todosListHeaderTitle"),
      count: byId("todosListHeaderCount"),
      dateBadge: byId("todosListHeaderDateBadge"),
      projectActions: byId("projectViewActionsButton"),
    };
  }

  function getBulkToolbar() {
    return {
      toolbar: byId("bulkActionsToolbar"),
      selectAll: byId("selectAllCheckbox"),
      countLabel: byId("bulkCount"),
    };
  }

  function getTodoRowElement(todoId) {
    if (!todoId) return null;
    return document.querySelector(
      `.todos-list [data-todo-id="${escapeSelectorValue(todoId)}"]`,
    );
  }

  function getTodoRowCheckboxes(todoId) {
    const row = getTodoRowElement(todoId);
    if (!(row instanceof HTMLElement)) {
      return { bulk: null, completed: null };
    }
    return {
      bulk: row.querySelector(".bulk-checkbox"),
      completed: row.querySelector(".todo-checkbox"),
    };
  }

  function getTodoKebabElements(todoId) {
    const row = getTodoRowElement(todoId);
    if (!(row instanceof HTMLElement)) {
      return { trigger: null, menu: null };
    }
    return {
      trigger: row.querySelector(".todo-kebab"),
      menu: row.querySelector(".todo-kebab-menu"),
    };
  }

  function getCategoryGroupHeader(categoryKey) {
    if (!categoryKey) return null;
    return document.querySelector(
      `.todo-group-header[data-category-group-key="${escapeSelectorValue(categoryKey)}"]`,
    );
  }

  function getRailElements() {
    const desktopList = byId("projectsRailList");
    const sheetList =
      byId("projectsRailSheetList") ||
      document.querySelector("#projectsRailSheet .projects-rail__list");
    const desktopAllCount = document.querySelector(
      '#projectsRail .workspace-view-item[data-workspace-view="all"] .projects-rail-item__count',
    );
    const desktopUnsortedCount = document.querySelector(
      '#projectsRail .workspace-view-item[data-workspace-view="unsorted"] .projects-rail-item__count',
    );
    const sheetAllCount = document.querySelector(
      '#projectsRailSheet .workspace-view-item[data-workspace-view="all"] .projects-rail-item__count',
    );
    const sheetUnsortedCount = document.querySelector(
      '#projectsRailSheet .workspace-view-item[data-workspace-view="unsorted"] .projects-rail-item__count',
    );

    return {
      desktopList,
      sheetList,
      desktopAllCount,
      desktopUnsortedCount,
      sheetAllCount,
      sheetUnsortedCount,
    };
  }

  function getConfirmDialogElements() {
    return {
      overlay: byId("confirmDialog"),
      message: byId("confirmDialogMessage"),
      ok: byId("confirmDialogOk"),
      cancel: byId("confirmDialogCancel"),
    };
  }

  function getInputDialogElements() {
    return {
      overlay: byId("inputDialog"),
      label: byId("inputDialogLabel"),
      field: byId("inputDialogField"),
      ok: byId("inputDialogOk"),
      cancel: byId("inputDialogCancel"),
    };
  }

  function getEditTodoModalElements() {
    return {
      overlay: byId("editTodoModal"),
      title: byId("editTodoTitle"),
      description: byId("editTodoDescription"),
      project: byId("editTodoProjectSelect"),
      priority: byId("editTodoPriority"),
      dueDate: byId("editTodoDueDate"),
      notes: byId("editTodoNotes"),
    };
  }

  globalScope.DomSelectors = {
    byId,
    escapeSelectorValue,
    getTodosContainer,
    getTodosScrollRegion,
    getTodosListHeader,
    getBulkToolbar,
    getTodoRowElement,
    getTodoRowCheckboxes,
    getTodoKebabElements,
    getCategoryGroupHeader,
    getRailElements,
    getConfirmDialogElements,
    getInputDialogElements,
    getEditTodoModalElements,
  };
})(window);
