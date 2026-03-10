// =============================================================================
// overlayManager.js — Overlay / dialog / modal management.
// Owns: showConfirmDialog, showInputDialog, openEditTodoModal,
//       closeEditTodoModal, saveEditedTodo.
// Imports only from store.js. Cross-module calls go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { EventBus } from "./eventBus.js";

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------

export function showConfirmDialog(message, onConfirm, onCancel) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmDialog");
    const msgEl = document.getElementById("confirmDialogMessage");
    const okBtn = document.getElementById("confirmDialogOk");
    const cancelBtn = document.getElementById("confirmDialogCancel");
    if (!overlay || !msgEl || !okBtn || !cancelBtn) {
      const result = window.confirm(message);
      if (result) onConfirm && onConfirm();
      else onCancel && onCancel();
      resolve(result);
      return;
    }

    msgEl.textContent = message;
    overlay.style.display = "flex";
    okBtn.focus({ preventScroll: true });

    function cleanup() {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
      overlay.removeEventListener("click", handleBackdrop);
      document.removeEventListener("keydown", handleKey);
    }

    function handleOk() {
      cleanup();
      onConfirm && onConfirm();
      resolve(true);
    }

    function handleCancel() {
      cleanup();
      onCancel && onCancel();
      resolve(false);
    }

    function handleBackdrop(e) {
      if (e.target === overlay) handleCancel();
    }

    function handleKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleOk();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }

    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
    overlay.addEventListener("click", handleBackdrop);
    document.addEventListener("keydown", handleKey);
  });
}

// ---------------------------------------------------------------------------
// Input dialog
// ---------------------------------------------------------------------------

export function showInputDialog(promptText, onSubmit, onCancel) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("inputDialog");
    const labelEl = document.getElementById("inputDialogLabel");
    const field = document.getElementById("inputDialogField");
    const okBtn = document.getElementById("inputDialogOk");
    const cancelBtn = document.getElementById("inputDialogCancel");
    if (!overlay || !labelEl || !field || !okBtn || !cancelBtn) {
      const result = window.prompt(promptText);
      if (result !== null) onSubmit && onSubmit(result);
      else onCancel && onCancel();
      resolve(result);
      return;
    }

    labelEl.textContent = promptText;
    field.value = "";
    overlay.style.display = "flex";
    field.focus({ preventScroll: true });

    function cleanup() {
      overlay.style.display = "none";
      okBtn.removeEventListener("click", handleOk);
      cancelBtn.removeEventListener("click", handleCancel);
      overlay.removeEventListener("click", handleBackdrop);
      document.removeEventListener("keydown", handleKey);
    }

    function handleOk() {
      const value = field.value;
      cleanup();
      onSubmit && onSubmit(value);
      resolve(value);
    }

    function handleCancel() {
      cleanup();
      onCancel && onCancel();
      resolve(null);
    }

    function handleBackdrop(e) {
      if (e.target === overlay) handleCancel();
    }

    function handleKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleOk();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    }

    okBtn.addEventListener("click", handleOk);
    cancelBtn.addEventListener("click", handleCancel);
    overlay.addEventListener("click", handleBackdrop);
    document.addEventListener("keydown", handleKey);
  });
}

// ---------------------------------------------------------------------------
// Edit Todo Modal
// ---------------------------------------------------------------------------

export function openEditTodoModal(todoId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  state.editingTodoId = todoId;

  const toDateTimeLocalValue = hooks.toDateTimeLocalValue || ((v) => v || "");
  const updateProjectSelectOptions =
    hooks.updateProjectSelectOptions || (() => {});

  document.getElementById("editTodoTitle").value = todo.title || "";
  document.getElementById("editTodoDescription").value = todo.description || "";
  updateProjectSelectOptions();
  document.getElementById("editTodoProjectSelect").value = todo.category || "";
  document.getElementById("editTodoPriority").value = todo.priority || "medium";
  document.getElementById("editTodoDueDate").value = toDateTimeLocalValue(
    todo.dueDate,
  );
  document.getElementById("editTodoNotes").value = todo.notes || "";

  document.getElementById("editTodoModal").style.display = "flex";
  document.getElementById("editTodoTitle")?.focus();
}

export function closeEditTodoModal() {
  state.editingTodoId = null;
  document.getElementById("editTodoModal").style.display = "none";
}

export async function saveEditedTodo() {
  if (!state.editingTodoId) return;
  const title = document.getElementById("editTodoTitle").value.trim();
  const validateTodoTitle = hooks.validateTodoTitle || (() => null);
  const titleError = validateTodoTitle(title);
  const showMessage = hooks.showMessage || (() => {});
  if (titleError) {
    showMessage("todosMessage", titleError, "error");
    return;
  }

  const normalizeProjectPath = hooks.normalizeProjectPath || ((v) => v);
  const project = normalizeProjectPath(
    document.getElementById("editTodoProjectSelect").value,
  );
  const priority = document.getElementById("editTodoPriority").value;
  const dueDateRaw = document.getElementById("editTodoDueDate").value;
  const description = document
    .getElementById("editTodoDescription")
    .value.trim();
  const notes = document.getElementById("editTodoNotes").value.trim();

  const payload = {
    title,
    priority,
    category: project || null,
    dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : null,
    description: description || "",
    notes: notes || null,
  };

  try {
    await hooks.applyTodoPatch(state.editingTodoId, payload);
    EventBus.dispatch("todos:changed", { reason: "todo-updated" });
    hooks.syncTodoDrawerStateWithRender?.();
    closeEditTodoModal();
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
