/**
 * projectWriteActions.ts — Write action handlers for project CRUD and planning.
 *
 * Actions: create_project, update_project, rename_project, delete_project,
 *          archive_project, plan_project, ensure_next_action
 *
 * plan_project and ensure_next_action conditionally use handleIdempotent
 * only when mode === "apply" (same logic as inline executor switch).
 */

import {
  validateAgentCreateProjectInput,
  validateAgentUpdateProjectInput,
  validateAgentRenameProjectInput,
  validateAgentDeleteProjectInput,
  validateAgentArchiveProjectInput,
  validateAgentPlanProjectInput,
  validateAgentEnsureNextActionInput,
} from "../../../validation/agentValidation";
import { AgentExecutionError } from "./agentExecutionError";
import { IDEMPOTENT_PLANNER_APPLY_ACTIONS } from "./agentTypes";
import type { ActionRegistry, ActionRuntime } from "./actionRegistry";
import type { AgentExecutionContext, AgentExecutionResult } from "./agentTypes";

type RawParams = Record<string, unknown>;

export function registerProjectWriteActions(registry: ActionRegistry): void {
  registry.registerRaw(
    "create_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const createInput = validateAgentCreateProjectInput(params);
      return runtime.exec.handleIdempotent(
        "create_project",
        context,
        createInput,
        async () => {
          const project = await runtime.agentService.createProject(
            context.userId,
            createInput as Parameters<
              typeof runtime.agentService.createProject
            >[1],
          );
          return { project };
        },
        201,
      );
    },
  );

  registry.registerRaw(
    "update_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, changes } = validateAgentUpdateProjectInput(params);
      return runtime.exec.handleIdempotent(
        "update_project",
        context,
        params,
        async () => {
          const project = await runtime.agentService.updateProject(
            context.userId,
            id,
            changes,
          );
          if (!project) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Project not found",
              false,
              "Verify the project ID belongs to the authenticated user.",
            );
          }
          return { project };
        },
      );
    },
  );

  registry.registerRaw(
    "rename_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, name } = validateAgentRenameProjectInput(params);
      return runtime.exec.handleIdempotent(
        "rename_project",
        context,
        params,
        async () => {
          const project = await runtime.agentService.renameProject(
            context.userId,
            id,
            name,
          );
          if (!project) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Project not found",
              false,
              "Verify the project ID belongs to the authenticated user.",
            );
          }
          return { project };
        },
      );
    },
  );

  registry.registerRaw(
    "delete_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, moveTasksToProjectId, archiveInstead } =
        validateAgentDeleteProjectInput(params);
      return runtime.exec.handleIdempotent(
        "delete_project",
        context,
        params,
        async () => {
          if (archiveInstead) {
            const project = await runtime.agentService.archiveProject(
              context.userId,
              id,
              true,
            );
            if (!project) {
              throw new AgentExecutionError(
                404,
                "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
                "Project not found",
                false,
                "Verify the project ID belongs to the authenticated user.",
              );
            }
            return { deleted: false, archived: true, project };
          }
          const deleted = await runtime.agentService.deleteProject(
            context.userId,
            id,
            moveTasksToProjectId,
          );
          if (!deleted) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Project not found",
              false,
              "Verify the source and target project IDs belong to the authenticated user.",
            );
          }
          return {
            deleted: true,
            projectId: id,
            movedTasksToProjectId: moveTasksToProjectId,
            taskDisposition: moveTasksToProjectId ? "reassigned" : "unassigned",
          };
        },
      );
    },
  );

  registry.registerRaw(
    "archive_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { id, archived } = validateAgentArchiveProjectInput(params);
      return runtime.exec.handleIdempotent(
        "archive_project",
        context,
        params,
        async () => {
          const project = await runtime.agentService.archiveProject(
            context.userId,
            id,
            archived,
          );
          if (!project) {
            throw new AgentExecutionError(
              404,
              "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
              "Project not found",
              false,
              "Verify the project ID belongs to the authenticated user.",
            );
          }
          return { project };
        },
      );
    },
  );

  registry.registerRaw(
    "plan_project",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const plannerInput = validateAgentPlanProjectInput(params);
      const executePlan = async () => {
        const plan = await runtime.agentService.planProjectForUser(
          context.userId,
          plannerInput,
        );
        if (!plan) {
          throw new AgentExecutionError(
            404,
            "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
            "Project not found",
            false,
            "Verify the project ID belongs to the authenticated user.",
          );
        }
        return { plan };
      };
      if (
        IDEMPOTENT_PLANNER_APPLY_ACTIONS.has("plan_project") &&
        plannerInput.mode === "apply"
      ) {
        return runtime.exec.handleIdempotent(
          "plan_project",
          context,
          plannerInput,
          executePlan,
        );
      }
      return runtime.exec.success(
        "plan_project",
        false,
        context,
        200,
        await executePlan(),
      );
    },
  );

  registry.registerRaw(
    "ensure_next_action",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const plannerInput = validateAgentEnsureNextActionInput(params);
      const policies = await runtime.actionPolicyService.getPolicies(
        context.userId,
      );
      const actionMeta = runtime.actionPolicyService.buildActionMeta(
        "ensure_next_action",
        policies,
      );
      const executeEna = async () => {
        const result = await runtime.agentService.ensureNextActionForUser(
          context.userId,
          plannerInput,
        );
        if (!result) {
          throw new AgentExecutionError(
            404,
            "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
            "Project not found",
            false,
            "Verify the project ID belongs to the authenticated user.",
          );
        }
        return { result, actionMeta };
      };
      if (
        IDEMPOTENT_PLANNER_APPLY_ACTIONS.has("ensure_next_action") &&
        plannerInput.mode === "apply"
      ) {
        return runtime.exec.handleIdempotent(
          "ensure_next_action",
          context,
          plannerInput,
          executeEna,
        );
      }
      return runtime.exec.success(
        "ensure_next_action",
        false,
        context,
        200,
        await executeEna(),
      );
    },
  );
}
