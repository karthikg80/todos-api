import type {
  ActionRegistry,
  ActionRuntime,
  ActionContext,
} from "./actionRegistry";
import {
  validateAgentListTodayInput,
  validateAgentListNextActionsInput,
  validateAgentListWaitingOnInput,
  validateAgentListUpcomingInput,
  validateAgentListStaleTasksInput,
  validateAgentListProjectsWithoutNextActionInput,
  validateAgentReviewProjectsInput,
} from "../../../validation/agentValidation";

export function registerViewListActions(registry: ActionRegistry): void {
  registry.register(
    "list_today",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListTodayInput(params);
      const tasks = await runtime.agentService.listToday(
        context.userId,
        filters,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "list_next_actions",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListNextActionsInput(params);
      const tasks = await runtime.agentService.listNextActions(
        context.userId,
        filters,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "list_waiting_on",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListWaitingOnInput(params);
      const tasks = await runtime.agentService.listWaitingOn(
        context.userId,
        filters,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "list_upcoming",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListUpcomingInput(params);
      const tasks = await runtime.agentService.listUpcoming(
        context.userId,
        filters,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "list_stale_tasks",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListStaleTasksInput(params);
      const tasks = await runtime.agentService.listStaleTasks(
        context.userId,
        filters,
      );
      return { status: 200, data: { tasks } };
    },
  );

  registry.register(
    "list_projects_without_next_action",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentListProjectsWithoutNextActionInput(params);
      const projects = await runtime.agentService.listProjectsWithoutNextAction(
        context.userId,
        filters,
      );
      return { status: 200, data: { projects } };
    },
  );

  registry.register(
    "review_projects",
    async (
      params: Record<string, unknown>,
      context: ActionContext,
      runtime: ActionRuntime,
    ) => {
      const filters = validateAgentReviewProjectsInput(params);
      const projects = await runtime.agentService.reviewProjects(
        context.userId,
        filters,
      );
      return { status: 200, data: { projects } };
    },
  );
}
