// =============================================================================
// overlayManager.js — Central overlay coordination and dialog helpers.
// Owns: DialogManager, showConfirmDialog, showInputDialog, openEditTodoModal,
//       closeEditTodoModal, saveEditedTodo.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";

const DomSelectors = window.DomSelectors || {};

let lastConfirmTrigger = null;
let lastInputTrigger = null;
let lastEditTodoModalTrigger = null;

function restoreFocus(target) {
  if (target instanceof HTMLElement && target.isConnected) {
    target.focus({ preventScroll: true });
  }
}

function getConfirmDialogElements() {
  if (DomSelectors.getConfirmDialogElements) {
    return DomSelectors.getConfirmDialogElements();
  }
  return {
    overlay: document.getElementById("confirmDialog"),
    message: document.getElementById("confirmDialogMessage"),
    ok: document.getElementById("confirmDialogOk"),
    cancel: document.getElementById("confirmDialogCancel"),
  };
}

function getInputDialogElements() {
  if (DomSelectors.getInputDialogElements) {
    return DomSelectors.getInputDialogElements();
  }
  return {
    overlay: document.getElementById("inputDialog"),
    label: document.getElementById("inputDialogLabel"),
    field: document.getElementById("inputDialogField"),
    ok: document.getElementById("inputDialogOk"),
    cancel: document.getElementById("inputDialogCancel"),
  };
}

function getEditTodoModalElements() {
  if (DomSelectors.getEditTodoModalElements) {
    return DomSelectors.getEditTodoModalElements();
  }
  return {
    overlay: document.getElementById("editTodoModal"),
    title: document.getElementById("editTodoTitle"),
    description: document.getElementById("editTodoDescription"),
    project: document.getElementById("editTodoProjectSelect"),
    priority: document.getElementById("editTodoPriority"),
    dueDate: document.getElementById("editTodoDueDate"),
    notes: document.getElementById("editTodoNotes"),
  };
}

export const DialogManager = (() => {
  const stack = [];

  function getFocusable(el) {
    return Array.from(
      el.querySelectorAll(
        "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled])," +
          'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ).filter(
      (element) =>
        !element.closest("[hidden]") && element.offsetParent !== null,
    );
  }

  function trapFocus(event) {
    const top = stack[stack.length - 1];
    if (!top) return;
    const focusable = getFocusable(top.el);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleKeydown(event) {
    if (event.key === "Tab" && stack.length > 0) {
      trapFocus(event);
      event.stopPropagation();
      return;
    }

    if (event.key === "Escape" && stack.length > 0) {
      event.stopPropagation();
      const top = stack[stack.length - 1];
      if (typeof top.onEscape === "function") {
        top.onEscape();
      }
    }
  }

  document.addEventListener("keydown", handleKeydown, true);

  return {
    open(layerId, el, opts = {}) {
      if (stack.some((entry) => entry.layerId === layerId)) return;
      el.setAttribute("aria-modal", "true");
      if (!el.getAttribute("role")) {
        el.setAttribute("role", "dialog");
      }
      stack.push({ layerId, el, onEscape: opts.onEscape || null });
    },

    close(layerId) {
      const index = stack.findIndex((entry) => entry.layerId === layerId);
      if (index === -1) return;
      const [entry] = stack.splice(index, 1);
      entry.el.removeAttribute("aria-modal");
    },

    closeAll() {
      while (stack.length > 0) {
        const entry = stack.pop();
        entry.el.removeAttribute("aria-modal");
      }
    },

    isOpen(layerId) {
      return stack.some((entry) => entry.layerId === layerId);
    },

    get depth() {
      return stack.length;
    },
  };
})();

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

export function showConfirmDialog(message, onConfirm, onCancel) {
  return new Promise((resolve) => {
    const refs = getConfirmDialogElements();
    const { overlay, message: messageEl, ok, cancel } = refs;
    if (
      !(overlay instanceof HTMLElement) ||
      !(messageEl instanceof HTMLElement) ||
      !(ok instanceof HTMLButtonElement) ||
      !(cancel instanceof HTMLButtonElement)
    ) {
      const result = window.confirm(message);
      if (result) onConfirm?.();
      else onCancel?.();
      resolve(result);
      return;
    }

    lastConfirmTrigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    messageEl.textContent = message;
    overlay.style.display = "flex";
    DialogManager.open("confirmDialog", overlay, {
      onEscape: () => handleCancel(),
    });

    function cleanup() {
      overlay.style.display = "none";
      ok.removeEventListener("click", handleOk);
      cancel.removeEventListener("click", handleCancel);
      overlay.removeEventListener("click", handleBackdrop);
      DialogManager.close("confirmDialog");
      restoreFocus(lastConfirmTrigger);
      lastConfirmTrigger = null;
    }

    function handleOk() {
      cleanup();
      onConfirm?.();
      resolve(true);
    }

    function handleCancel() {
      cleanup();
      onCancel?.();
      resolve(false);
    }

    function handleBackdrop(event) {
      if (event.target === overlay) {
        handleCancel();
      }
    }

    ok.addEventListener("click", handleOk);
    cancel.addEventListener("click", handleCancel);
    overlay.addEventListener("click", handleBackdrop);
    ok.focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------------------
// Input dialog
// ---------------------------------------------------------------------------

export function showInputDialog(promptText, onSubmit, onCancel) {
  return new Promise((resolve) => {
    const refs = getInputDialogElements();
    const { overlay, label, field, ok, cancel } = refs;
    if (
      !(overlay instanceof HTMLElement) ||
      !(label instanceof HTMLElement) ||
      !(field instanceof HTMLInputElement) ||
      !(ok instanceof HTMLButtonElement) ||
      !(cancel instanceof HTMLButtonElement)
    ) {
      const result = window.prompt(promptText);
      if (result !== null) onSubmit?.(result);
      else onCancel?.();
      resolve(result);
      return;
    }

    lastInputTrigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    label.textContent = promptText;
    field.value = "";
    overlay.style.display = "flex";
    DialogManager.open("inputDialog", overlay, {
      onEscape: () => handleCancel(),
    });

    function cleanup() {
      overlay.style.display = "none";
      ok.removeEventListener("click", handleOk);
      cancel.removeEventListener("click", handleCancel);
      overlay.removeEventListener("click", handleBackdrop);
      field.removeEventListener("keydown", handleFieldKeydown);
      DialogManager.close("inputDialog");
      restoreFocus(lastInputTrigger);
      lastInputTrigger = null;
    }

    function handleOk() {
      const value = field.value;
      cleanup();
      onSubmit?.(value);
      resolve(value);
    }

    function handleCancel() {
      cleanup();
      onCancel?.();
      resolve(null);
    }

    function handleBackdrop(event) {
      if (event.target === overlay) {
        handleCancel();
      }
    }

    function handleFieldKeydown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        handleOk();
      }
    }

    ok.addEventListener("click", handleOk);
    cancel.addEventListener("click", handleCancel);
    overlay.addEventListener("click", handleBackdrop);
    field.addEventListener("keydown", handleFieldKeydown);
    field.focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------------------
// Edit Todo Modal
// ---------------------------------------------------------------------------

export function openEditTodoModal(todoId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;

  const refs = getEditTodoModalElements();
  const { overlay, title, description, project, priority, dueDate, notes } =
    refs;
  if (
    !(overlay instanceof HTMLElement) ||
    !(title instanceof HTMLInputElement) ||
    !(description instanceof HTMLTextAreaElement) ||
    !(project instanceof HTMLSelectElement) ||
    !(priority instanceof HTMLSelectElement) ||
    !(dueDate instanceof HTMLInputElement) ||
    !(notes instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  state.editingTodoId = todoId;
  lastEditTodoModalTrigger =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

  const toDateTimeLocalValue =
    hooks.toDateTimeLocalValue || ((value) => value || "");
  const updateProjectSelectOptions =
    hooks.updateProjectSelectOptions || (() => {});

  title.value = todo.title || "";
  description.value = todo.description || "";
  updateProjectSelectOptions();
  project.value = todo.category || "";
  priority.value = todo.priority || "medium";
  dueDate.value = toDateTimeLocalValue(todo.dueDate);
  notes.value = todo.notes || "";

  overlay.style.display = "flex";
  DialogManager.open("editTodoModal", overlay, {
    onEscape: () => closeEditTodoModal(),
  });
  overlay.addEventListener("click", handleEditTodoModalBackdropClick);
  title.focus({ preventScroll: true });
}

function handleEditTodoModalBackdropClick(event) {
  const refs = getEditTodoModalElements();
  if (!(refs.overlay instanceof HTMLElement)) return;
  if (event.target === refs.overlay) {
    closeEditTodoModal();
  }
}

export function closeEditTodoModal({
  restoreFocus: shouldRestoreFocus = true,
} = {}) {
  const refs = getEditTodoModalElements();
  if (refs.overlay instanceof HTMLElement) {
    refs.overlay.style.display = "none";
    refs.overlay.removeEventListener("click", handleEditTodoModalBackdropClick);
  }
  DialogManager.close("editTodoModal");
  state.editingTodoId = null;

  if (shouldRestoreFocus) {
    restoreFocus(lastEditTodoModalTrigger);
  }
  lastEditTodoModalTrigger = null;
}

export async function saveEditedTodo() {
  if (!state.editingTodoId) return;

  const refs = getEditTodoModalElements();
  const { title, description, project, priority, dueDate, notes } = refs;
  if (
    !(title instanceof HTMLInputElement) ||
    !(description instanceof HTMLTextAreaElement) ||
    !(project instanceof HTMLSelectElement) ||
    !(priority instanceof HTMLSelectElement) ||
    !(dueDate instanceof HTMLInputElement) ||
    !(notes instanceof HTMLTextAreaElement)
  ) {
    return;
  }

  const nextTitle = title.value.trim();
  const validateTodoTitle = hooks.validateTodoTitle || (() => null);
  const titleError = validateTodoTitle(nextTitle);
  const showMessage = hooks.showMessage || (() => {});
  if (titleError) {
    showMessage("todosMessage", titleError, "error");
    return;
  }

  const normalizeProjectPath = hooks.normalizeProjectPath || ((value) => value);
  const normalizedProject = normalizeProjectPath(project.value);
  const payload = {
    title: nextTitle,
    priority: priority.value,
    category: normalizedProject || null,
    dueDate: dueDate.value ? new Date(dueDate.value).toISOString() : null,
    description: description.value.trim() || "",
    notes: notes.value.trim() || null,
  };

  try {
    await hooks.applyTodoPatch(state.editingTodoId, payload);
    EventBus.dispatch("todos:changed", { reason: "todo-updated" });
    hooks.syncTodoDrawerStateWithRender?.();
    closeEditTodoModal({ restoreFocus: false });
    showMessage("todosMessage", "Task updated", "success");
  } catch (error) {
    console.error("Save edited todo failed:", error);
    showMessage(
      "todosMessage",
      error.message || "Failed to update task",
      "error",
    );
  }
}
