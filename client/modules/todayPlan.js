// =============================================================================
// todayPlan.js — Today Plan workspace view module.
//
// Renders the Today Plan: a defended, date-specific set of tasks the user
// commits to working on. Integrates with the /plans API.
// =============================================================================
import { state, hooks } from "./store.js";

// ── Plan state slice ──
// Kept as a separate object to avoid polluting the global state bag.
export const planState = {
  currentPlan: null,
  isLoading: false,
  error: null,
};

// ── API helpers ──

async function fetchPlan(endpoint, options = {}) {
  try {
    planState.isLoading = true;
    planState.error = null;
    const res = await hooks.apiCall(endpoint, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    planState.error = err.message;
    throw err;
  } finally {
    planState.isLoading = false;
  }
}

// ── Public API ──

export async function loadTodayPlan() {
  const plan = await fetchPlan("/plans/today");
  planState.currentPlan = plan;
  renderTodayPlan();
  return plan;
}

export async function addTaskToPlan(todoId) {
  if (!planState.currentPlan) return;
  const plan = await fetchPlan(`/plans/${planState.currentPlan.id}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ todoId }),
  });
  planState.currentPlan = plan;
  renderTodayPlan();
  return plan;
}

export async function removeTaskFromPlan(todoId) {
  if (!planState.currentPlan) return;
  const plan = await fetchPlan(
    `/plans/${planState.currentPlan.id}/tasks/${todoId}`,
    { method: "DELETE" },
  );
  planState.currentPlan = plan;
  renderTodayPlan();
  return plan;
}

export async function finalizePlan() {
  if (!planState.currentPlan) return;
  const plan = await fetchPlan(`/plans/${planState.currentPlan.id}/finalize`, {
    method: "POST",
  });
  planState.currentPlan = plan;
  renderTodayPlan();
  return plan;
}

export async function reviewPlan() {
  if (!planState.currentPlan) return;
  const review = await fetchPlan(`/plans/${planState.currentPlan.id}/review`, {
    method: "POST",
  });
  renderPlanReview(review);
  return review;
}

// ── Rendering ──

export function renderTodayPlan() {
  const container = document.getElementById("todayPlanContainer");
  if (!container) return;

  const plan = planState.currentPlan;
  if (!plan) {
    container.innerHTML = `
      <div class="today-plan-empty">
        <p>No plan for today yet.</p>
        <button data-onclick="loadTodayPlan" class="btn btn-primary">
          Create Today's Plan
        </button>
      </div>
    `;
    return;
  }

  const statusBadge =
    {
      draft: '<span class="plan-badge plan-badge--draft">Draft</span>',
      finalized: '<span class="plan-badge plan-badge--active">Active</span>',
      reviewed: '<span class="plan-badge plan-badge--reviewed">Reviewed</span>',
    }[plan.status] || "";

  const taskListHtml =
    plan.tasks.length === 0
      ? '<p class="today-plan-hint">Add tasks from your todo list to build your plan.</p>'
      : plan.tasks
          .map((planTask) => {
            const todo = planTask.todo || {};
            const completedClass = planTask.completed
              ? "plan-task--completed"
              : "";
            const deferredClass = planTask.deferred
              ? "plan-task--deferred"
              : "";
            const priorityClass = todo.priority
              ? `priority-${todo.priority}`
              : "";
            const estimateStr = todo.estimateMinutes
              ? `<span class="plan-task-estimate">${todo.estimateMinutes}m</span>`
              : "";
            const categoryStr = todo.category
              ? `<span class="plan-task-category">${escapeHtml(todo.category)}</span>`
              : "";

            return `
            <div class="plan-task ${completedClass} ${deferredClass}" data-todo-id="${todo.id}">
              <span class="plan-task-order">${planTask.order + 1}</span>
              <span class="plan-task-priority ${priorityClass}"></span>
              <span class="plan-task-title">${escapeHtml(todo.title || "(unknown)")}</span>
              ${categoryStr}
              ${estimateStr}
              <button class="plan-task-remove" data-onclick="removeTaskFromPlan" data-todo-id="${todo.id}" title="Remove from plan">×</button>
            </div>
          `;
          })
          .join("");

  const totalEstimate = plan.tasks.reduce((sum, t) => {
    return sum + (t.todo?.estimateMinutes || 0);
  }, 0);
  const estimateSummary =
    totalEstimate > 0
      ? `<span class="plan-estimate-total">${totalEstimate}m planned</span>`
      : "";

  const actionsHtml =
    plan.status === "draft"
      ? `<div class="plan-actions">
        <button data-onclick="finalizePlan" class="btn btn-primary btn-sm">
          Commit to Plan
        </button>
      </div>`
      : plan.status === "finalized"
        ? `<div class="plan-actions">
          <button data-onclick="reviewPlan" class="btn btn-secondary btn-sm">
            End-of-Day Review
          </button>
        </div>`
        : "";

  container.innerHTML = `
    <div class="today-plan">
      <div class="today-plan-header">
        <h2>Today's Plan</h2>
        ${statusBadge}
        ${estimateSummary}
      </div>
      <div class="today-plan-tasks">
        ${taskListHtml}
      </div>
      ${actionsHtml}
    </div>
  `;
}

function renderPlanReview(review) {
  const container = document.getElementById("todayPlanContainer");
  if (!container) return;

  const taskRows = review.tasks
    .map((t) => {
      const status = t.completed ? "✓" : t.deferred ? "→" : "✗";
      const statusClass = t.completed
        ? "review-completed"
        : t.deferred
          ? "review-deferred"
          : "review-missed";
      return `
        <div class="review-task ${statusClass}">
          <span class="review-status">${status}</span>
          <span class="review-title">${escapeHtml(t.title)}</span>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="plan-review">
      <div class="plan-review-header">
        <h2>Day Review — ${review.date}</h2>
      </div>
      <div class="plan-review-stats">
        <div class="review-stat">
          <span class="review-stat-value">${review.completionRate}%</span>
          <span class="review-stat-label">Completion</span>
        </div>
        <div class="review-stat">
          <span class="review-stat-value">${review.totalCompleted}/${review.totalCommitted}</span>
          <span class="review-stat-label">Tasks Done</span>
        </div>
        <div class="review-stat">
          <span class="review-stat-value">${review.totalDeferred}</span>
          <span class="review-stat-label">Deferred</span>
        </div>
      </div>
      <div class="plan-review-tasks">
        ${taskRows}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
