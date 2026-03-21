// =============================================================================
// initProjectsFeature.js — Project-domain functions extracted from app.js.
//
// These functions handle project heading reordering and todo-to-heading
// assignment. They access shared state and services through the hooks registry.
// =============================================================================

import { state, hooks } from "../../modules/store.js";

const { showMessage } = window.Utils || {};

// ---------------------------------------------------------------------------
// Project heading functions
// ---------------------------------------------------------------------------

function moveProjectHeading(headingId, direction) {
  const headings = hooks.getProjectHeadings?.() || [];
  const currentIndex = headings.findIndex(
    (heading) => String(heading.id) === String(headingId),
  );
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + Number(direction);
  if (nextIndex < 0 || nextIndex >= headings.length) return;
  const targetId = String(headings[nextIndex]?.id || "");
  if (!targetId) return;
  reorderProjectHeadings(String(headingId), targetId, "before");
}

function reorderProjectHeadings(draggedId, targetId, placement = "before") {
  const projectName = hooks.getSelectedProjectKey?.() || "";
  const projectRecord = hooks.getProjectRecordByName?.(projectName);
  if (!projectRecord?.id) return;

  const projectId = String(projectRecord.id);
  const headings = [...(hooks.getProjectHeadings?.(projectName) || [])];
  if (!headings.length) return;

  const draggedIndex = headings.findIndex(
    (heading) => String(heading.id) === String(draggedId),
  );
  const targetIndex = headings.findIndex(
    (heading) => String(heading.id) === String(targetId),
  );
  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
    return;
  }

  const [draggedHeading] = headings.splice(draggedIndex, 1);
  let insertIndex = targetIndex + (placement === "after" ? 1 : 0);
  if (draggedIndex < insertIndex) {
    insertIndex -= 1;
  }
  insertIndex = Math.max(0, Math.min(insertIndex, headings.length));
  headings.splice(insertIndex, 0, draggedHeading);

  state.projectHeadingsByProjectId.set(
    projectId,
    headings.map((heading, index) => ({
      ...heading,
      sortOrder: index,
    })),
  );
  hooks.renderTodos?.();

  void (async () => {
    try {
      const response = await hooks.apiCall(
        `${hooks.API_URL}/projects/${encodeURIComponent(projectId)}/headings/reorder`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            headings.map((heading, index) => ({
              id: String(heading.id),
              sortOrder: index,
            })),
          ),
        },
      );
      if (!response || !response.ok) {
        throw new Error("Failed to persist heading order");
      }
    } catch (error) {
      console.error("Persist heading reorder failed:", error);
      await hooks.scheduleLoadSelectedProjectHeadings?.();
      hooks.renderTodos?.();
      showMessage("todosMessage", "Failed to reorder headings", "error");
    }
  })();
}

async function moveTodoToHeading(todoId, headingIdValue) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  const nextHeadingId =
    typeof headingIdValue === "string" && headingIdValue.trim()
      ? headingIdValue.trim()
      : null;
  try {
    const updated = await hooks.applyTodoPatch?.(todoId, {
      headingId: nextHeadingId,
    });
    if (!nextHeadingId) {
      hooks.renderTodos?.();
      return;
    }
    const projectName = hooks.normalizeProjectPath?.(
      updated?.category || todo.category || "",
    );
    if (projectName) {
      await hooks.scheduleLoadSelectedProjectHeadings?.();
    }
    hooks.renderTodos?.();
  } catch (error) {
    console.error("Move todo heading failed:", error);
    showMessage("todosMessage", "Failed to move task to heading", "error");
  }
}

// ---------------------------------------------------------------------------
// Window bridge
// ---------------------------------------------------------------------------

function registerWindowBridge() {
  window.moveProjectHeading = moveProjectHeading;
  window.moveTodoToHeading = moveTodoToHeading;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function wireHooks() {
  hooks.moveTodoToHeading = moveTodoToHeading;
  hooks.reorderProjectHeadings = reorderProjectHeadings;
}

// ---------------------------------------------------------------------------
// Feature initializer
// ---------------------------------------------------------------------------

export function initProjectsFeature() {
  wireHooks();
  registerWindowBridge();
}

export { moveProjectHeading, reorderProjectHeadings, moveTodoToHeading };
