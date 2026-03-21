// =============================================================================
// todoSelectors.js — Derived state helpers for the todos domain.
//
// Selectors provide a stable read interface over the shared state object.
// They encapsulate common query patterns so callers don't need to know
// the shape of `state.todos` or how filtering works.
// =============================================================================

import { state } from "../../modules/store.js";

/**
 * Get a single todo by ID, or null if not found.
 * @param {string} todoId
 * @returns {object|null}
 */
export function getTodoById(todoId) {
  if (!todoId) return null;
  return state.todos.find((t) => t.id === todoId) || null;
}

/**
 * Get the currently selected todo (based on state.selectedTodoId).
 * @returns {object|null}
 */
export function getSelectedTodo() {
  if (!state.selectedTodoId) return null;
  return getTodoById(state.selectedTodoId);
}

/**
 * Get all todos (unfiltered).
 * @returns {Array}
 */
export function getAllTodos() {
  return state.todos;
}

/**
 * Get the count of all loaded todos.
 * @returns {number}
 */
export function getTodoCount() {
  return state.todos.length;
}

/**
 * Get all open (non-completed, non-archived) todos.
 * @returns {Array}
 */
export function getOpenTodos() {
  return state.todos.filter((t) => !t.completed && !t.archived);
}

/**
 * Get the current todos loading state.
 * @returns {'idle'|'loading'|'loaded'|'error'}
 */
export function getTodosLoadState() {
  return state.todosLoadState || "idle";
}

/**
 * Check if todos are currently loading.
 * @returns {boolean}
 */
export function isTodosLoading() {
  return state.todosLoadState === "loading";
}

/**
 * Get the todos load error message, or null.
 * @returns {string|null}
 */
export function getTodosLoadError() {
  return state.todosLoadErrorMessage || null;
}

/**
 * Get the set of currently selected (bulk-select) todo IDs.
 * @returns {Set}
 */
export function getSelectedTodoIds() {
  return state.selectedTodos;
}

/**
 * Check if a specific todo is selected in bulk selection.
 * @param {string} todoId
 * @returns {boolean}
 */
export function isTodoSelected(todoId) {
  return state.selectedTodos.has(todoId);
}

/**
 * Get the count of selected todos.
 * @returns {number}
 */
export function getSelectedTodoCount() {
  return state.selectedTodos.size;
}
