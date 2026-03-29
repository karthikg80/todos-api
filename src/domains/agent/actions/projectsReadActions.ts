import type {
  ActionRegistry,
  ActionRuntime,
  ActionContext,
} from "./actionRegistry";
import { AgentExecutionError } from "./agentExecutionError";
import {
  validateAgentListProjectsInput,
  validateAgentGetProjectInput,
} from "../../../validation/agentValidation";

export function registerProjectsReadActions(registry: ActionRegistry): void {
  registry.register(
    "list_projects",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListProjectsInput(params);
      const projects = await runtime.agentService.listProjects(
        context.userId,
        filters,
      );
      return { status: 200, data: { projects } };
    },
  );

  registry.register(
    "get_project",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const { id } = validateAgentGetProjectInput(params);
      const project = await runtime.agentService.getProject(context.userId, id);
      if (!project) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND_OR_FORBIDDEN",
          "Project not found",
          false,
          "Verify the project ID belongs to the authenticated user.",
        );
      }
      return { status: 200, data: { project } };
    },
  );
}
