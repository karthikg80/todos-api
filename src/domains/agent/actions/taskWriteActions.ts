/**
 * taskWriteActions.ts — Write action handlers for task CRUD and subtask operations.
 *
 * Actions: create_task, update_task, complete_task, archive_task, delete_task,
 *          add_subtask, update_subtask, delete_subtask, move_task_to_project
 *
 * All handlers use runtime.exec.handleIdempotent for write safety.
 * create_task uses status 201; add_subtask uses status 201.
 */

import {
  validateAgentCreateTaskInput,
  validateAgentUpdateTaskInput,
  validateAgentCompleteTaskInput,
  validateAgentArchiveTaskInput,
  validateAgentDeleteTaskInput,
  validateAgentAddSubtaskInput,
  validateAgentUpdateSubtaskInput,
  validateAgentDeleteSubtaskInput,
  validateAgentMoveTaskToProjectInput,
} from "../../../validation/agentValidation";
import { AgentExecutionError } from "./agentExecutionError";
import type { ActionRegistry, ActionRuntime } from "./actionRegistry";
import type { AgentExecutionContext, AgentExecutionResult } from "./agentTypes";

type RawParams = Record<string, unknown>;

export function registerTaskWriteActions(registry: ActionRegistry): void {
  registry.registerRaw(
    "create_task",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const createInput = validateAgentCreateTaskInput(params);
      if (createInput.dryRun === true) {
        const dryRunResult = runtime.exec.buildDryRunResult(
          "create_task",
          params,
        );
        return runtime.exec.success(
          "create_task",
          false,
          context,
          200,
          dryRunResult,
        );
      }
      const { dryRun: _createDryRun, ...createFields } = createInput;
      return runtime.exec.handleIdempotent(
        "create_task",
        context,
        createFields,
        async () => {
          const task = await runtime.agentService.createTask(
            context.userId,
            createFields as Parameters<
              typeof runtime.agentService.createTask
            >[1],
          );
          return { task };
        },
        201,
      );
    },
  );

  registry.registerRaw(
    "update_task",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, changes, dryRun } = validateAgentUpdateTaskInput(params);
      if (dryRun === true) {
        const dryRunResult = runtime.exec.buildDryRunResult("update_task", {
          ...params,
          id,
        });
        return runtime.exec.success(
          "update_task",
          false,
          context,
          200,
          dryRunResult,
        );
      }
      return runtime.exec.handleIdempotent(
        "update_task",
        context,
        params,
        async () => {
          const task = await runtime.agentService.updateTask(
            context.userId,
            id,
            changes,
          );
          if (!task) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          return { task };
        },
      );
    },
  );

  registry.registerRaw(
    "complete_task",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, completed } = validateAgentCompleteTaskInput(params);
      return runtime.exec.handleIdempotent(
        "complete_task",
        context,
        params,
        async () => {
          const task = await runtime.agentService.completeTask(
            context.userId,
            id,
            completed,
          );
          if (!task) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          return { task };
        },
      );
    },
  );

  registry.registerRaw(
    "archive_task",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, archived } = validateAgentArchiveTaskInput(params);
      return runtime.exec.handleIdempotent(
        "archive_task",
        context,
        params,
        async () => {
          const task = await runtime.agentService.archiveTask(
            context.userId,
            id,
            archived,
          );
          if (!task) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          return { task };
        },
      );
    },
  );

  registry.registerRaw(
    "delete_task",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, hardDelete } = validateAgentDeleteTaskInput(params);
      return runtime.exec.handleIdempotent(
        "delete_task",
        context,
        params,
        async () => {
          const result = await runtime.agentService.deleteTask(
            context.userId,
            id,
            hardDelete,
          );
          if (!result) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the task ID belongs to the authenticated user.",
            );
          }
          return {
            deleted: hardDelete === true,
            archived: hardDelete === true ? false : true,
            task: typeof result === "boolean" ? null : result,
            taskId: id,
          };
        },
      );
    },
  );

  registry.registerRaw(
    "add_subtask",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { taskId, changes } = validateAgentAddSubtaskInput(params);
      return runtime.exec.handleIdempotent(
        "add_subtask",
        context,
        params,
        async () => {
          const subtask = await runtime.agentService.addSubtask(
            context.userId,
            taskId,
            changes,
          );
          if (!subtask) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task not found",
              false,
              "Verify the parent task ID belongs to the authenticated user.",
            );
          }
          return { subtask };
        },
        201,
      );
    },
  );

  registry.registerRaw(
    "update_subtask",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { taskId, subtaskId, changes } =
        validateAgentUpdateSubtaskInput(params);
      return runtime.exec.handleIdempotent(
        "update_subtask",
        context,
        params,
        async () => {
          const subtask = await runtime.agentService.updateSubtask(
            context.userId,
            taskId,
            subtaskId,
            changes,
          );
          if (!subtask) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task or subtask not found",
              false,
              "Verify the task ID and subtask ID belong to the authenticated user.",
            );
          }
          return { subtask };
        },
      );
    },
  );

  registry.registerRaw(
    "delete_subtask",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { taskId, subtaskId } = validateAgentDeleteSubtaskInput(params);
      return runtime.exec.handleIdempotent(
        "delete_subtask",
        context,
        params,
        async () => {
          const deleted = await runtime.agentService.deleteSubtask(
            context.userId,
            taskId,
            subtaskId,
          );
          if (!deleted) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task or subtask not found",
              false,
              "Verify the task ID and subtask ID belong to the authenticated user.",
            );
          }
          return { deleted: true, taskId, subtaskId };
        },
      );
    },
  );

  registry.registerRaw(
    "move_task_to_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { taskId, projectId } = validateAgentMoveTaskToProjectInput(params);
      return runtime.exec.handleIdempotent(
        "move_task_to_project",
        context,
        params,
        async () => {
          const task = await runtime.agentService.moveTaskToProject(
            context.userId,
            taskId,
            projectId,
          );
          if (!task) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Task or project not found",
              false,
              "Verify the task ID and target project ID belong to the authenticated user.",
            );
          }
          return { task };
        },
      );
    },
  );
}
