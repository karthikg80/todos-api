// =============================================================================
// dragDrop.js — Todo and heading drag-and-drop event handlers.
// Imports only from store.js and todosService.js.
// Cross-module calls (reorderProjectHeadings, moveTodoToHeading,
// getSelectedProjectKey, normalizeProjectPath) go through hooks.
// =============================================================================

import { state, hooks } from "./store.js";
import { reorderTodos } from "./todosService.js";

let draggedOverTodoId = null;
let draggedHeadingId = null;

function resolveDragRow(event, selector, fallbackElement = null) {
  const candidateTargets = [];
  if (fallbackElement instanceof Element) {
    candidateTargets.push(fallbackElement);
  }
  const target = event?.target;
  if (target instanceof Element) {
    candidateTargets.push(target);
  }
  const currentTarget = event?.currentTarget;
  if (currentTarget instanceof Element) {
    candidateTargets.push(currentTarget);
  }

  for (const candidate of candidateTargets) {
    if (candidate.matches(selector)) {
      return candidate instanceof HTMLElement ? candidate : null;
    }
    const closest = candidate.closest(selector);
    if (closest instanceof HTMLElement) {
      return closest;
    }
  }

  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    const pointTarget = document.elementFromPoint(clientX, clientY);
    if (pointTarget instanceof Element) {
      if (pointTarget.matches(selector)) {
        return pointTarget instanceof HTMLElement ? pointTarget : null;
      }
      const closest = pointTarget.closest(selector);
      if (closest instanceof HTMLElement) {
        return closest;
      }
    }
  }

  return null;
}

function getTodoRowFromDragEvent(event, fallbackElement = null) {
  return resolveDragRow(event, ".todo-item[data-todo-id]", fallbackElement);
}

function getHeadingRowFromDragEvent(event, fallbackElement = null) {
  return resolveDragRow(
    event,
    ".todo-heading-divider[data-heading-id]",
    fallbackElement,
  );
}

function getHeadingDropTargetFromTodo(todoId, dropPosition = "before") {
  const projectName = hooks.getSelectedProjectKey();
  const headings = hooks.getProjectHeadings(projectName);
  if (!headings.length) {
    return null;
  }
  const headingIds = new Set(headings.map((heading) => String(heading.id)));
  const todo = state.todos.find((item) => String(item.id) === String(todoId));
  const todoHeadingId = String(todo?.headingId || "");
  if (todoHeadingId && headingIds.has(todoHeadingId)) {
    if (todoHeadingId === String(draggedHeadingId || "")) {
      const currentIndex = headings.findIndex(
        (heading) => String(heading.id) === todoHeadingId,
      );
      if (currentIndex >= 0) {
        const previousHeading = headings[currentIndex - 1] || null;
        const nextHeading = headings[currentIndex + 1] || null;
        if (dropPosition === "before") {
          if (previousHeading?.id) {
            return { targetId: String(previousHeading.id), placement: "after" };
          }
          if (nextHeading?.id) {
            return { targetId: String(nextHeading.id), placement: "before" };
          }
        } else {
          if (nextHeading?.id) {
            return { targetId: String(nextHeading.id), placement: "before" };
          }
          if (previousHeading?.id) {
            return { targetId: String(previousHeading.id), placement: "after" };
          }
        }
      }
    }
    return { targetId: todoHeadingId, placement: dropPosition };
  }
  const edgeHeading =
    dropPosition === "after" ? headings[headings.length - 1] : headings[0];
  if (!edgeHeading?.id) {
    return null;
  }
  return { targetId: String(edgeHeading.id), placement: dropPosition };
}

function handleDragStart(e, rowElement = null) {
  const row = getTodoRowFromDragEvent(e, rowElement);
  if (!row) return;
  state.draggedTodoId = row.dataset.todoId;
  draggedHeadingId = null;
  row.classList.add("dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", state.draggedTodoId || "");
  }
}

function handleDragOver(e, rowElement = null) {
  if (draggedHeadingId) {
    const row = getTodoRowFromDragEvent(e, rowElement);
    if (!row) return;
    const todoId = String(row.dataset.todoId || "");
    if (!todoId) return;
    e.preventDefault();
    clearHeadingDragState();
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.headingDropPosition = dropPosition;
    row.classList.add("todo-item--heading-drop-target");
    row.classList.add(
      dropPosition === "after"
        ? "todo-item--heading-drop-after"
        : "todo-item--heading-drop-before",
    );
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    return;
  }

  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }

  const row = getTodoRowFromDragEvent(e, rowElement);
  if (!row) return;
  document.querySelectorAll(".todo-item").forEach((item) => {
    if (item === row) return;
    delete item.dataset.todoDropPosition;
    item.classList.remove("drag-over");
  });
  const todoId = row?.dataset.todoId || "";
  if (todoId !== state.draggedTodoId) {
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.todoDropPosition = dropPosition;
    row?.classList.add("drag-over");
    draggedOverTodoId = todoId;
  }
}

function handleDrop(e, rowElement = null) {
  if (draggedHeadingId) {
    e.preventDefault();
    e.stopPropagation();
    const row = getTodoRowFromDragEvent(e, rowElement);
    if (!row) return;
    const targetTodoId = String(row.dataset.todoId || "");
    const dropPosition =
      row.dataset.headingDropPosition === "after" ? "after" : "before";
    const headingDropTarget = getHeadingDropTargetFromTodo(
      targetTodoId,
      dropPosition,
    );
    if (headingDropTarget) {
      hooks.reorderProjectHeadings(
        draggedHeadingId,
        headingDropTarget.targetId,
        headingDropTarget.placement,
      );
    }
    clearHeadingDragState();
    draggedHeadingId = null;
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  const row = getTodoRowFromDragEvent(e, rowElement);
  const dropTargetId = row?.dataset.todoId || "";
  const placement =
    row?.dataset.todoDropPosition === "after" ? "after" : "before";
  if (row) {
    delete row.dataset.todoDropPosition;
  }
  row?.classList.remove("drag-over");

  if (
    state.draggedTodoId &&
    dropTargetId &&
    state.draggedTodoId !== dropTargetId
  ) {
    const selectedProject = hooks.getSelectedProjectKey();
    const targetTodo =
      state.todos.find((todo) => todo.id === dropTargetId) || null;
    const nextHeadingId = selectedProject
      ? String(targetTodo?.headingId || "")
      : null;
    const movedId = state.draggedTodoId;
    reorderTodos(movedId, dropTargetId, {
      nextHeadingId: selectedProject ? nextHeadingId || null : undefined,
      placement,
    });
    // Apply settle animation after DOM re-renders
    requestAnimationFrame(() => {
      const movedRow = document.querySelector(
        `.todo-item[data-todo-id="${movedId}"]`,
      );
      if (movedRow instanceof HTMLElement) {
        movedRow.classList.add("todo-item--settling");
        movedRow.addEventListener(
          "animationend",
          () => movedRow.classList.remove("todo-item--settling"),
          { once: true },
        );
      }
    });
  }
}

function handleDragEnd(e, rowElement = null) {
  const row = getTodoRowFromDragEvent(e, rowElement);
  row?.classList.remove("dragging");
  document.querySelectorAll(".todo-item").forEach((item) => {
    item.classList.remove("drag-over");
    delete item.dataset.todoDropPosition;
  });
  clearHeadingDragState();
  state.draggedTodoId = null;
  draggedOverTodoId = null;
}

function clearHeadingDragState() {
  document.querySelectorAll(".todo-heading-divider").forEach((row) => {
    row.classList.remove(
      "todo-heading-divider--dragging",
      "todo-heading-divider--drag-over-before",
      "todo-heading-divider--drag-over-after",
    );
    delete row.dataset.headingDropPosition;
  });
  document.querySelectorAll(".todo-item").forEach((row) => {
    row.classList.remove(
      "todo-item--heading-drop-target",
      "todo-item--heading-drop-before",
      "todo-item--heading-drop-after",
    );
    delete row.dataset.headingDropPosition;
  });
}

function handleHeadingDragStart(e, rowElement = null) {
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const headingId = row.dataset.headingId || "";
  if (!headingId) return;

  draggedHeadingId = headingId;
  state.draggedTodoId = null;
  row.classList.add("todo-heading-divider--dragging");
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", headingId);
  }
}

function handleHeadingDragOver(e, rowElement = null) {
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const targetHeadingId = row.dataset.headingId || "";

  if (draggedHeadingId) {
    if (!targetHeadingId || targetHeadingId === draggedHeadingId) return;
    e.preventDefault();
    clearHeadingDragState();
    const bounds = row.getBoundingClientRect();
    const dropPosition =
      e.clientY > bounds.top + bounds.height / 2 ? "after" : "before";
    row.dataset.headingDropPosition = dropPosition;
    row.classList.add(
      dropPosition === "after"
        ? "todo-heading-divider--drag-over-after"
        : "todo-heading-divider--drag-over-before",
    );
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
    return;
  }

  if (!state.draggedTodoId || !targetHeadingId) return;
  e.preventDefault();
  clearHeadingDragState();
  row.classList.add("todo-heading-divider--drag-over-before");
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
}

function getFirstTodoIdInHeading(headingId, excludeTodoId = null) {
  const selectedProject = hooks.getSelectedProjectKey();
  const normalizedProject = hooks.normalizeProjectPath(selectedProject);
  const candidates = [...state.todos]
    .filter((todo) => {
      const todoProject = hooks.normalizeProjectPath(todo.category || "");
      if (normalizedProject && todoProject !== normalizedProject) return false;
      if (excludeTodoId && String(todo.id) === String(excludeTodoId))
        return false;
      return String(todo.headingId || "") === String(headingId || "");
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return candidates[0]?.id || null;
}

function handleHeadingDrop(e, rowElement = null) {
  e.preventDefault();
  e.stopPropagation();
  const row = getHeadingRowFromDragEvent(e, rowElement);
  if (!row) return;
  const targetHeadingId = row.dataset.headingId || "";
  if (!targetHeadingId) return;

  if (draggedHeadingId) {
    const dropPosition =
      row.dataset.headingDropPosition === "after" ? "after" : "before";
    if (draggedHeadingId !== targetHeadingId) {
      hooks.reorderProjectHeadings(
        draggedHeadingId,
        targetHeadingId,
        dropPosition,
      );
    }
    clearHeadingDragState();
    draggedHeadingId = null;
    return;
  }

  if (!state.draggedTodoId) return;
  const firstTodoId = getFirstTodoIdInHeading(
    targetHeadingId,
    state.draggedTodoId,
  );
  if (firstTodoId) {
    reorderTodos(state.draggedTodoId, firstTodoId, {
      nextHeadingId: targetHeadingId,
    });
  } else {
    hooks.moveTodoToHeading(state.draggedTodoId, targetHeadingId);
  }
  clearHeadingDragState();
}

function handleHeadingDragEnd() {
  clearHeadingDragState();
  draggedHeadingId = null;
}

export {
  resolveDragRow,
  getTodoRowFromDragEvent,
  getHeadingRowFromDragEvent,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  clearHeadingDragState,
  handleHeadingDragStart,
  handleHeadingDragOver,
  getFirstTodoIdInHeading,
  handleHeadingDrop,
  handleHeadingDragEnd,
};
