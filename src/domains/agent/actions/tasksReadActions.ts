import type {
  ActionRegistry,
  ActionRuntime,
  ActionContext,
} from "./actionRegistry";
import { AgentExecutionError } from "./agentExecutionError";
import {
  validateAgentListTasksInput,
  validateAgentSearchTasksInput,
  validateAgentGetTaskInput,
} from "../../../validation/agentValidation";

export function registerTasksReadActions(registry: ActionRegistry): void {
  registry.register(
    "list_tasks",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const query = validateAgentListTasksInput(params);
      const tasks = await runtime.agentService.listTasks(context.userId, query);
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "search_tasks",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const query = validateAgentSearchTasksInput(params);
      const tasks = await runtime.agentService.searchTasks(
        context.userId,
        query,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "get_task",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { id } = validateAgentGetTaskInput(params);
      const task = await runtime.agentService.getTask(context.userId, id);
      if (!task) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
          "Task not found",
          false,
          "Verify the task ID belongs to the authenticated user.",
        );
      }
      return { status: 200, data: { task } };
    },
  );
}
