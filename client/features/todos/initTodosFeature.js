// =============================================================================
// initTodosFeature.js — Todo-domain functions extracted from app.js.
//
// These functions handle todo-specific UI interactions (subtask toggling,
// notes expansion, priority setting, AI breakdown, keyboard shortcuts).
// They access shared state and services through the hooks registry.
// =============================================================================

import { state, hooks } from "../../modules/store.js";
import {
  getTodoById,
  getSelectedTodo,
  getAllTodos,
  getOpenTodos,
} from "./todoSelectors.js";

const { escapeHtml, showMessage } = window.Utils || {};

// ---------------------------------------------------------------------------
// Todo-domain functions
// ---------------------------------------------------------------------------

function handleTodoKeyPress(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    hooks.submitTaskComposerCapture?.();
  }
}
function setPriority(priority) {
  state.currentPriority = priority;

  document.querySelectorAll(".priority-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document
    .getElementById(
      `priority${priority.charAt(0).toUpperCase() + priority.slice(1)}`,
    )
    .classList.add("active");
  hooks.updateQuickEntryPropertiesSummary?.();
}

function getPriorityIcon(priority) {
  const icons = {
    high: "🔴",
    medium: "🟡",
    low: "🟢",
  };
  return icons[priority] || icons.medium;
}

function toggleNotesInput() {
  const notesInput = document.getElementById("todoNotesInput");
  const icon = document.getElementById("notesExpandIcon");

  if (notesInput.style.display === "none") {
    notesInput.style.display = "block";
    icon.classList.add("expanded");
  } else {
    notesInput.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function toggleNotes(todoId, event) {
  event.stopPropagation();
  const content = document.getElementById(`notes-content-${todoId}`);
  const icon = document.getElementById(`notes-icon-${todoId}`);

  if (content.style.display === "none") {
    content.style.display = "block";
    icon.classList.add("expanded");
  } else {
    content.style.display = "none";
    icon.classList.remove("expanded");
  }
}

function renderSubtasks(todo) {
  const completedCount = todo.subtasks.filter((s) => s.completed).length;
  const totalCount = todo.subtasks.length;

  return `
                <div class="subtasks-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                        <span style="font-size: 0.85em; color: var(--text-secondary);">
                            ☑️ Subtasks: ${completedCount}/${totalCount}
                        </span>
                    </div>
                    <ul class="subtask-list">
                        ${todo.subtasks
                          .map(
                            (subtask) => `
                            <li class="subtask-item ${subtask.completed ? "completed" : ""}">
                                <input
                                    type="checkbox"
                                    class="todo-checkbox"
                                    aria-label="Mark subtask ${escapeHtml(subtask.title)} complete"
                                    style="width: 16px; height: 16px;"
                                    ${subtask.completed ? "checked" : ""}
                                    data-onchange="toggleSubtask('${todo.id}', '${subtask.id}')"
                                >
                                <span class="subtask-title">${escapeHtml(subtask.title)}</span>
                            </li>
                        `,
                          )
                          .join("")}
                    </ul>
                </div>
            `;
}

async function toggleSubtask(todoId, subtaskId) {
  const todo = state.todos.find((t) => t.id === todoId);
  if (!todo || !todo.subtasks) return;

  const subtask = todo.subtasks.find((s) => s.id === subtaskId);
  if (!subtask) return;

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/todos/${todoId}/subtasks/${subtaskId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !subtask.completed }),
      },
    );

    if (response && response.ok) {
      const updatedSubtask = await response.json();
      todo.subtasks = todo.subtasks.map((s) =>
        s.id === subtaskId ? updatedSubtask : s,
      );
      hooks.renderTodos?.();
    }
  } catch (error) {
    console.error("Toggle subtask failed:", error);
  }
}

async function aiBreakdownTodo(todoId, force = false) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;

  try {
    const response = await hooks.apiCall(
      `${hooks.API_URL}/ai/todos/${todoId}/breakdown`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxSubtasks: 5, force }),
      },
    );
    const data = response ? await hooks.parseApiBody(response) : {};

    if (response && response.ok) {
      await hooks.loadTodos?.();
      await hooks.loadAiInsights?.();
      await hooks.loadAiFeedbackSummary?.();
      showMessage(
        "todosMessage",
        `Added ${data.createdCount || 0} AI subtasks for "${todo.title}"`,
        "success",
      );
      return;
    }

    if (response && response.status === 409) {
      const proceed = await hooks.showConfirmDialog?.(
        "This task already has subtasks. Generate additional subtasks anyway?",
      );
      if (proceed) {
        await aiBreakdownTodo(todoId, true);
      }
      return;
    }

    showMessage(
      "todosMessage",
      data.error || "Failed to generate subtasks",
      "error",
    );
  } catch (error) {
    console.error("AI breakdown error:", error);
    showMessage("todosMessage", "Failed to generate subtasks", "error");
  }
}

// ---------------------------------------------------------------------------
// Window bridge — these functions are referenced via data-onclick in HTML
// ---------------------------------------------------------------------------

function registerWindowBridge() {
  window.handleTodoKeyPress = handleTodoKeyPress;
  window.setPriority = setPriority;
  window.toggleNotesInput = toggleNotesInput;
  window.toggleNotes = toggleNotes;
  window.toggleSubtask = toggleSubtask;
  window.aiBreakdownTodo = aiBreakdownTodo;
}

// ---------------------------------------------------------------------------
// Hooks — expose functions to other modules via the hooks registry
// ---------------------------------------------------------------------------

function wireHooks() {
  hooks.renderSubtasks = renderSubtasks;
  hooks.setPriority = setPriority;
  hooks.getTodoById = getTodoById;
  hooks.getSelectedTodo = getSelectedTodo;
  hooks.getAllTodos = getAllTodos;
  hooks.getOpenTodos = getOpenTodos;
}

// ---------------------------------------------------------------------------
// Feature initializer
// ---------------------------------------------------------------------------

export function initTodosFeature() {
  wireHooks();
  registerWindowBridge();
}

// Re-export for direct use where needed
export {
  handleTodoKeyPress,
  setPriority,
  getPriorityIcon,
  toggleNotesInput,
  toggleNotes,
  renderSubtasks,
  toggleSubtask,
  aiBreakdownTodo,
};
