// =============================================================================
// todoActions.js — Named state mutation entry points for the todos domain.
//
// These actions encapsulate the most common todo state mutations that are
// currently done via direct `state.todos` manipulation across modules.
// They complement (not replace) the existing stateActions.js pattern.
// =============================================================================

import { state } from "../../modules/store.js";

/**
 * Replace a todo in the state array by ID (in-place update).
 * @param {string} todoId
 * @param {object} updatedTodo — the full updated todo object
 * @returns {boolean} true if the todo was found and replaced
 */
export function replaceTodoInState(todoId, updatedTodo) {
  const index = state.todos.findIndex((item) => item.id === todoId);
  if (index < 0) return false;
  state.todos[index] = updatedTodo;
  return true;
}

/**
 * Update specific fields on a todo in the state array.
 * @param {string} todoId
 * @param {object} patch — fields to merge into the todo
 * @returns {object|null} the updated todo, or null if not found
 */
export function patchTodoInState(todoId, patch) {
  const index = state.todos.findIndex((item) => item.id === todoId);
  if (index < 0) return null;
  state.todos[index] = { ...state.todos[index], ...patch };
  return state.todos[index];
}

/**
 * Remove a todo from the state array by ID.
 * @param {string} todoId
 * @returns {object|null} the removed todo, or null if not found
 */
export function removeTodoFromState(todoId) {
  const index = state.todos.findIndex((item) => item.id === todoId);
  if (index < 0) return null;
  const [removed] = state.todos.splice(index, 1);
  return removed;
}

/**
 * Add a todo to the beginning of the state array.
 * @param {object} todo
 */
export function prependTodoToState(todo) {
  state.todos.unshift(todo);
}

/**
 * Set the todos loading state.
 * @param {'idle'|'loading'|'loaded'|'error'} loadState
 * @param {string} [errorMessage]
 */
export function setTodosLoadState(loadState, errorMessage) {
  state.todosLoadState = loadState;
  if (errorMessage !== undefined) {
    state.todosLoadErrorMessage = errorMessage;
  }
}
