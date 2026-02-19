import { ITodoService } from "./interfaces/ITodoService";
import { IProjectService } from "./interfaces/IProjectService";
import { Priority } from "./types";
import {
  NormalizedTodoBoundSuggestion,
  NormalizedTodayPlanSuggestion,
} from "./aiNormalizationService";

// ── Result types ──

export type ApplyTodoBoundResult =
  | {
      ok: true;
      updatedTodo: NonNullable<Awaited<ReturnType<ITodoService["findById"]>>>;
    }
  | { ok: false; status: number; error: string };

export type ApplyTodayPlanResult =
  | {
      ok: true;
      updatedTodos: NonNullable<
        Awaited<ReturnType<ITodoService["findById"]>>
      >[];
      appliedTodoIds: string[];
    }
  | { ok: false; status: number; error: string };

// ── Todo-bound apply ──

export async function applyTodoBoundSuggestion(params: {
  selected: NormalizedTodoBoundSuggestion;
  todoService: ITodoService;
  projectService?: IProjectService;
  userId: string;
  inputTodoId: string;
  todo: NonNullable<Awaited<ReturnType<ITodoService["findById"]>>>;
  confirmed?: boolean;
}): Promise<ApplyTodoBoundResult> {
  const {
    selected,
    todoService,
    projectService,
    userId,
    inputTodoId,
    todo,
    confirmed,
  } = params;
  const payload = selected.payload || {};
  const now = Date.now();
  let updatedTodo = todo;

  switch (selected.type) {
    case "rewrite_title": {
      const nextTitle =
        typeof payload.title === "string" ? payload.title.trim() : "";
      if (!nextTitle || nextTitle.length > 200) {
        return { ok: false, status: 400, error: "Invalid rewrite title" };
      }
      const updated = await todoService.update(userId, inputTodoId, {
        title: nextTitle,
      });
      if (!updated) {
        return { ok: false, status: 404, error: "Todo not found" };
      }
      updatedTodo = updated;
      break;
    }
    case "set_due_date": {
      const dueDateISO =
        typeof payload.dueDateISO === "string" ? payload.dueDateISO : "";
      const parsed = new Date(dueDateISO);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, status: 400, error: "Invalid due date" };
      }
      if (parsed.getTime() < now && confirmed !== true) {
        return {
          ok: false,
          status: 400,
          error: "Past due dates require explicit confirmation",
        };
      }
      const updated = await todoService.update(userId, inputTodoId, {
        dueDate: parsed,
      });
      if (!updated) {
        return { ok: false, status: 404, error: "Todo not found" };
      }
      updatedTodo = updated;
      break;
    }
    case "set_priority": {
      const priority = String(payload.priority || "").toLowerCase();
      if (!["low", "medium", "high"].includes(priority)) {
        return { ok: false, status: 400, error: "Invalid priority value" };
      }
      if (priority === "high" && confirmed !== true) {
        return {
          ok: false,
          status: 400,
          error: "High priority changes require explicit confirmation",
        };
      }
      const updated = await todoService.update(userId, inputTodoId, {
        priority: priority as Priority,
      });
      if (!updated) {
        return { ok: false, status: 404, error: "Todo not found" };
      }
      updatedTodo = updated;
      break;
    }
    case "set_category":
    case "set_project": {
      let nextCategory =
        typeof payload.category === "string" ? payload.category.trim() : "";
      const projectName =
        typeof payload.projectName === "string"
          ? payload.projectName.trim()
          : "";
      const projectId =
        typeof payload.projectId === "string" ? payload.projectId.trim() : "";

      if (!nextCategory && projectName) {
        nextCategory = projectName;
      }

      if (projectId && projectService) {
        const projects = await projectService.findAll(userId);
        const byId = projects.find((item) => item.id === projectId);
        if (byId) {
          nextCategory = byId.name;
        }
      } else if (projectName && projectService) {
        const projects = await projectService.findAll(userId);
        const byName = projects.find(
          (item) => item.name.toLowerCase() === projectName.toLowerCase(),
        );
        if (byName) {
          nextCategory = byName.name;
        }
      }

      if (!nextCategory || nextCategory.length > 50) {
        return {
          ok: false,
          status: 400,
          error: "Invalid category/project value",
        };
      }

      const updated = await todoService.update(userId, inputTodoId, {
        category: nextCategory,
      });
      if (!updated) {
        return { ok: false, status: 404, error: "Todo not found" };
      }
      updatedTodo = updated;
      break;
    }
    case "split_subtasks": {
      const subtasksRaw = Array.isArray(payload.subtasks)
        ? payload.subtasks
        : [];
      if (subtasksRaw.length < 1 || subtasksRaw.length > 5) {
        return {
          ok: false,
          status: 400,
          error: "split_subtasks requires 1-5 subtasks",
        };
      }
      for (const item of subtasksRaw.slice(0, 5)) {
        const title =
          item && typeof item === "object" && typeof item.title === "string"
            ? item.title.trim()
            : "";
        if (!title || title.length > 200) {
          return { ok: false, status: 400, error: "Invalid subtask title" };
        }
        const created = await todoService.createSubtask(userId, inputTodoId, {
          title,
        });
        if (!created) {
          return { ok: false, status: 404, error: "Todo not found" };
        }
      }
      updatedTodo = (await todoService.findById(userId, inputTodoId)) || todo;
      break;
    }
    case "propose_next_action": {
      const textCandidate =
        typeof payload.text === "string"
          ? payload.text
          : typeof payload.title === "string"
            ? payload.title
            : "";
      const nextAction = textCandidate.trim();
      if (!nextAction || nextAction.length > 200) {
        return { ok: false, status: 400, error: "Invalid next action text" };
      }
      const prefix = "Next action: ";
      const nextNotes = updatedTodo.notes
        ? `${updatedTodo.notes}\n${prefix}${nextAction}`
        : `${prefix}${nextAction}`;
      const updated = await todoService.update(userId, inputTodoId, {
        notes: nextNotes,
      });
      if (!updated) {
        return { ok: false, status: 404, error: "Todo not found" };
      }
      updatedTodo = updated;
      break;
    }
    case "ask_clarification":
    case "defer_task":
    default: {
      return {
        ok: false,
        status: 400,
        error: `Suggestion type "${selected.type}" is not supported for apply`,
      };
    }
  }

  return { ok: true, updatedTodo };
}

// ── Today-plan apply ──

export async function applyTodayPlanSuggestions(params: {
  applicableSuggestions: NormalizedTodayPlanSuggestion[];
  todoService: ITodoService;
  userId: string;
  confirmed?: boolean;
}): Promise<ApplyTodayPlanResult> {
  const { applicableSuggestions, todoService, userId, confirmed } = params;

  const updatedTodosMap = new Map<
    string,
    NonNullable<Awaited<ReturnType<ITodoService["findById"]>>>
  >();

  for (const selected of applicableSuggestions) {
    const payload = selected.payload || {};
    const todoId = typeof payload.todoId === "string" ? payload.todoId : "";
    if (!todoId) continue;

    const currentTodo =
      updatedTodosMap.get(todoId) ||
      (await todoService.findById(userId, todoId));
    if (!currentTodo) continue;

    if (selected.requiresConfirmation && confirmed !== true) {
      return {
        ok: false,
        status: 400,
        error: "Confirmation is required for this suggestion",
      };
    }

    if (selected.type === "set_priority") {
      const priority = String(payload.priority || "").toLowerCase();
      if (!["low", "medium", "high"].includes(priority)) {
        return { ok: false, status: 400, error: "Invalid priority value" };
      }
      if (priority === "high" && confirmed !== true) {
        return {
          ok: false,
          status: 400,
          error: "High priority changes require explicit confirmation",
        };
      }
      const updated = await todoService.update(userId, todoId, {
        priority: priority as Priority,
      });
      if (updated) updatedTodosMap.set(todoId, updated);
      continue;
    }

    if (selected.type === "set_due_date") {
      const dueDateISO =
        typeof payload.dueDateISO === "string" ? payload.dueDateISO : "";
      const parsed = new Date(dueDateISO);
      if (Number.isNaN(parsed.getTime())) {
        return { ok: false, status: 400, error: "Invalid due date" };
      }
      if (parsed.getTime() < Date.now() && confirmed !== true) {
        return {
          ok: false,
          status: 400,
          error: "Past due dates require explicit confirmation",
        };
      }
      const updated = await todoService.update(userId, todoId, {
        dueDate: parsed,
      });
      if (updated) updatedTodosMap.set(todoId, updated);
      continue;
    }

    if (selected.type === "split_subtasks") {
      const subtasksRaw = Array.isArray(payload.subtasks)
        ? payload.subtasks
        : [];
      if (subtasksRaw.length < 1 || subtasksRaw.length > 5) {
        return {
          ok: false,
          status: 400,
          error: "split_subtasks requires 1-5 subtasks",
        };
      }
      for (const item of subtasksRaw.slice(0, 5)) {
        const title =
          item && typeof item === "object" && typeof item.title === "string"
            ? item.title.trim()
            : "";
        if (!title || title.length > 200) {
          return { ok: false, status: 400, error: "Invalid subtask title" };
        }
        await todoService.createSubtask(userId, todoId, { title });
      }
      const refreshed = await todoService.findById(userId, todoId);
      if (refreshed) updatedTodosMap.set(todoId, refreshed);
      continue;
    }

    if (selected.type === "propose_next_action") {
      const textCandidate =
        typeof payload.text === "string"
          ? payload.text
          : typeof payload.title === "string"
            ? payload.title
            : "";
      const nextAction = textCandidate.trim();
      if (!nextAction || nextAction.length > 200) {
        return { ok: false, status: 400, error: "Invalid next action text" };
      }
      const nextNotes = currentTodo.notes
        ? `${currentTodo.notes}\nNext action: ${nextAction}`
        : `Next action: ${nextAction}`;
      const updated = await todoService.update(userId, todoId, {
        notes: nextNotes,
      });
      if (updated) updatedTodosMap.set(todoId, updated);
    }
  }

  const updatedTodos = Array.from(updatedTodosMap.values());
  const appliedTodoIds = updatedTodos.map((todo) => todo.id);
  return { ok: true, updatedTodos, appliedTodoIds };
}
