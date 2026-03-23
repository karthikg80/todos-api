// =============================================================================
// uiTemplates.js — Shared string-template helpers for repeated UI structures.
// =============================================================================

import { hooks } from "./store.js";

function escapeHtml(value) {
  if (typeof hooks.escapeHtml === "function") {
    return hooks.escapeHtml(value);
  }
  return String(value ?? "");
}

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export function renderPanelHeader({
  className,
  titleClass,
  title,
  actionsHtml = "",
} = {}) {
  return `
    <div class="${className}">
      <div class="${titleClass}">${escapeHtml(title)}</div>
      ${actionsHtml}
    </div>
  `;
}

export function renderStatusMessage({
  className = "ai-empty",
  message,
  role = "status",
} = {}) {
  return `<div class="${className}" role="${escapeHtml(role)}">${escapeHtml(message)}</div>`;
}

export function renderPanelState({
  headerClass,
  titleClass,
  title,
  actionsHtml = "",
  debugHtml = "",
  message,
  messageClass = "ai-empty",
  role = "status",
} = {}) {
  return `
    ${renderPanelHeader({ className: headerClass, titleClass, title, actionsHtml })}
    ${debugHtml}
    ${renderStatusMessage({ className: messageClass, message, role })}
  `;
}

export function renderDrawerSection({
  title = "",
  bodyHtml = "",
  className = "todo-drawer__section",
  titleClass = "todo-drawer__section-title",
} = {}) {
  return `
    <div class="${className}">
      ${title ? `<div class="${titleClass}">${escapeHtml(title)}</div>` : ""}
      ${bodyHtml}
    </div>
  `;
}

export function renderDrawerAccordionSection({
  sectionClass = "todo-drawer__section",
  toggleId,
  panelId,
  title,
  expanded,
  bodyHtml = "",
} = {}) {
  return `
    <div class="${sectionClass}">
      <button
        id="${escapeHtml(toggleId)}"
        type="button"
        class="todo-drawer__accordion-toggle"
        aria-expanded="${expanded ? "true" : "false"}"
        aria-controls="${escapeHtml(panelId)}"
      >
        <span>${escapeHtml(title)}</span>
        <span class="todo-drawer__accordion-chevron" aria-hidden="true">${expanded ? "▾" : "▸"}</span>
      </button>
      <div
        id="${escapeHtml(panelId)}"
        class="todo-drawer__accordion-panel ${expanded ? "todo-drawer__accordion-panel--open" : ""}"
        aria-hidden="${expanded ? "false" : "true"}"
        ${expanded ? "" : "hidden"}
      >
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function renderTodoRowTemplate({
  todo,
  isSelected = false,
  isActive = false,
  kebabExpanded = false,
  descriptionHtml = "",
  metaHtml = "",
  subtasksHtml = "",
  notesHtml = "",
  projectOptionsHtml = "",
  headingMoveOptionsHtml = "",
} = {}) {
  const hasSubtasks = !!(todo?.subtasks && todo.subtasks.length > 0);
  const title = escapeHtml(todo?.title || "");
  const notesLabel = hasSubtasks
    ? "AI Subtasks Generated"
    : "AI Break Down Into Subtasks";
  const hasMetaContent = !!(metaHtml || descriptionHtml);

  return `
    <li
      class="${joinClasses(
        "todo-item",
        todo?.completed ? "completed" : "",
        isActive ? "todo-item--active" : "",
        isSelected ? "todo-item--bulk-selected" : "",
      )}"
      draggable="true"
      data-todo-id="${escapeHtml(todo?.id || "")}"
      tabindex="0"
      data-ondragstart="handleDragStart(event, this)"
      data-ondragover="handleDragOver(event, this)"
      data-ondrop="handleDrop(event, this)"
      data-ondragend="handleDragEnd(event, this)"
    >
      <input
        type="checkbox"
        class="bulk-checkbox"
        aria-label="Select todo ${title}"
        ${isSelected ? "checked" : ""}
        data-onchange="toggleSelectTodo('${escapeHtml(todo?.id || "")}')"
        data-onclick="event.stopPropagation()"
      >
      <span class="drag-handle">⋮⋮</span>
      <input
        type="checkbox"
        class="todo-checkbox"
        aria-label="Mark todo ${title} complete"
        ${todo?.completed ? "checked" : ""}
        data-onchange="toggleTodo('${escapeHtml(todo?.id || "")}')"
      >
      <div class="todo-content" data-onclick="openTodoDrawer('${escapeHtml(todo?.id || "")}')">
        <div class="todo-title" title="${title}">${title}</div>
        ${descriptionHtml}
        ${hasMetaContent ? `<div class="todo-meta">${metaHtml}</div>` : ""}
        ${subtasksHtml}
        ${notesHtml}
      </div>
      <div class="todo-row-actions">
        <button
          type="button"
          class="todo-kebab"
          aria-label="More actions for ${title}"
          aria-expanded="${kebabExpanded ? "true" : "false"}"
          data-onclick="toggleTodoKebab('${escapeHtml(todo?.id || "")}', event)"
        >
          ⋯
        </button>
        <div
          class="todo-kebab-menu ${kebabExpanded ? "todo-kebab-menu--open" : ""}"
          role="menu"
          aria-label="Actions for ${title}"
        >
          <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openTodoFromKebab('${escapeHtml(todo?.id || "")}', event)">
            Open details
          </button>
          <button type="button" class="todo-kebab-item" role="menuitem" data-onclick="openEditTodoFromKebab('${escapeHtml(todo?.id || "")}', event)">
            Edit modal
          </button>
          <label class="todo-kebab-project-label">
            Move to project
            <select data-onclick="event.stopPropagation()" data-onchange="moveTodoToProject('${escapeHtml(todo?.id || "")}', this.value)">
              ${projectOptionsHtml}
            </select>
          </label>
          ${headingMoveOptionsHtml}
          <button
            type="button"
            class="todo-kebab-item"
            role="menuitem"
            ${hasSubtasks ? "disabled" : ""}
            data-onclick="aiBreakdownTodo('${escapeHtml(todo?.id || "")}')"
          >
            ${notesLabel}
          </button>
          <button type="button" class="todo-kebab-item todo-kebab-item--danger" role="menuitem" data-onclick="openDrawerDangerZone('${escapeHtml(todo?.id || "")}', event)">
            Delete
          </button>
        </div>
      </div>
    </li>
  `;
}
