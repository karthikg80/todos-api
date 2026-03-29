// =============================================================================
// todoListRenderer.js — Pure HTML renderers for todo rows and project headings.
// No DOM reads/writes. Returns HTML strings only.
// =============================================================================
import { state, hooks } from "../store.js";
import { renderTodoRowTemplate } from "../uiTemplates.js";
import { illustrationEmptyProject } from "../../utils/illustrations.js";
import { getSelectedProjectKey } from "./workspaceSemantics.js";

export function renderHeadingMoveOptions(todo) {
  const selectedProject = getSelectedProjectKey();
  if (!selectedProject) return "";
  const headings = hooks.getProjectHeadings?.(selectedProject) ?? [];
  if (!headings.length) return "";

  const options = headings
    .map(
      (h) =>
        `<option value="${h.id}"${String(todo.headingId) === String(h.id) ? " selected" : ""}>${hooks.escapeHtml?.(h.name)}</option>`,
    )
    .join("");

  return `
    <label class="todo-kebab-project-label">
      Move to heading
      <select data-onclick="event.stopPropagation()" data-onchange="moveTodoToHeading('${todo.id}', this.value)">
        <option value="">No heading</option>
        ${options}
      </select>
    </label>
  `;
}

export function renderTodoRowHtml(todo) {
  const isOverdue =
    todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
  const dueDateStr = todo.dueDate
    ? new Date(todo.dueDate).toLocaleString()
    : "";
  const isSelected = state.selectedTodos.has(todo.id);

  return renderTodoRowTemplate({
    todo,
    isSelected,
    isActive: state.selectedTodoId === todo.id,
    kebabExpanded: state.openTodoKebabId === todo.id,
    descriptionHtml: `
      <div class="todo-description-row">
        <div class="todo-description ${todo.description ? "" : "todo-description--placeholder"}">
          ${
            todo.description
              ? hooks.escapeHtml?.(todo.description)
              : "Add context, notes, or acceptance criteria"
          }
        </div>
        <button
          type="button"
          class="todo-description-trigger"
          data-onclick="openInlineDescriptionEditor('${todo.id}')"
          aria-label="${todo.description ? `Edit note for ${hooks.escapeHtml?.(todo.title)}` : `Add note for ${hooks.escapeHtml?.(todo.title)}`}"
        >
          ${todo.description ? "Edit note" : "Add note"}
        </button>
      </div>
    `,
    metaHtml: hooks.renderTodoChips?.(todo, { isOverdue, dueDateStr }) ?? "",
    subtasksHtml:
      todo.subtasks && todo.subtasks.length > 0
        ? (hooks.renderSubtasks?.(todo) ?? "")
        : "",
    notesHtml:
      todo.notes && todo.notes.trim()
        ? `
          <div class="notes-section">
            <button class="notes-toggle" data-onclick="toggleNotes('${todo.id}', event)">
              <span class="expand-icon" id="notes-icon-${todo.id}">\u25b6</span>
              <span>\u{1F4DD} Notes</span>
            </button>
            <div class="notes-content" id="notes-content-${todo.id}" style="display: none;">
              ${hooks.escapeHtml?.(String(todo.notes))}
            </div>
          </div>
        `
        : "",
    inlineEditorHtml: hooks.renderInlineTaskEditor?.(todo) ?? "",
    projectOptionsHtml:
      hooks.renderProjectOptions?.(String(todo.category || "")) ?? "",
    headingMoveOptionsHtml: renderHeadingMoveOptions(todo),
  });
}

export function renderProjectHeadingGroupedRows(projectTodos, projectName) {
  const headings = hooks.getProjectHeadings?.(projectName) ?? [];
  const normalizedProject = hooks.normalizeProjectPath(projectName);
  const todosForProject = [...projectTodos].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  const headingsById = new Map(
    headings.map((heading) => [String(heading.id), heading]),
  );
  const unheaded = [];
  const grouped = new Map();
  headings.forEach((heading) => grouped.set(String(heading.id), []));

  todosForProject.forEach((todo) => {
    const todoProject = hooks.normalizeProjectPath(todo.category || "");
    if (normalizedProject && todoProject && todoProject !== normalizedProject) {
      unheaded.push(todo);
      return;
    }
    const headingId = String(todo.headingId || "");
    if (!headingId || !headingsById.has(headingId)) {
      unheaded.push(todo);
      return;
    }
    grouped.get(headingId).push(todo);
  });

  let rows = `
    <li class="project-inline-actions" aria-label="Project actions">
      <button
        type="button"
        class="project-inline-actions__task add-btn"
        data-onclick="openTaskComposer()"
      >
        New Task
      </button>
      <button
        type="button"
        class="project-inline-actions__heading mini-btn"
        data-onclick="createHeadingForSelectedProject()"
      >
        Add Heading
      </button>
    </li>
  `;
  if (!unheaded.length && !headings.length) {
    rows += `
      <li class="project-inline-empty">
        ${illustrationEmptyProject()}
        <p>Start with a task or a heading. The project stays intentionally quiet until you add structure.</p>
      </li>
    `;
  }
  rows += unheaded.map((todo) => renderTodoRowHtml(todo)).join("");
  headings.forEach((heading, headingIndex) => {
    const items = grouped.get(String(heading.id)) || [];
    const moveUpDisabled = headingIndex === 0;
    const moveDownDisabled = headingIndex === headings.length - 1;
    rows += `
      <li
        class="todo-heading-divider"
        data-heading-id="${hooks.escapeHtml?.(String(heading.id))}"
        draggable="true"
        data-ondragstart="handleHeadingDragStart(event, this)"
        data-ondragover="handleHeadingDragOver(event, this)"
        data-ondrop="handleHeadingDrop(event, this)"
        data-ondragend="handleHeadingDragEnd(event, this)"
      >
        <span class="todo-heading-divider__title">${hooks.escapeHtml?.(String(heading.name))}</span>
        <span class="todo-heading-divider__meta">
          <span class="todo-heading-divider__drag-handle" aria-hidden="true"><svg class="app-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>
          <span class="todo-heading-divider__count">${items.length}</span>
          <button
            type="button"
            class="todo-heading-divider__move-btn"
            aria-label="Move heading up"
            title="Move heading up"
            ${moveUpDisabled ? "disabled" : ""}
            data-onclick="moveProjectHeading('${hooks.escapeHtml?.(String(heading.id))}', -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="todo-heading-divider__move-btn"
            aria-label="Move heading down"
            title="Move heading down"
            ${moveDownDisabled ? "disabled" : ""}
            data-onclick="moveProjectHeading('${hooks.escapeHtml?.(String(heading.id))}', 1)"
          >
            ↓
          </button>
        </span>
      </li>
    `;
    rows += items.map((todo) => renderTodoRowHtml(todo)).join("");
  });
  return rows;
}
