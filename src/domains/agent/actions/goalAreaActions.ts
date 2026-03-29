/**
 * goalAreaActions.ts — Action handlers for areas, goals, and routine detection.
 *
 * Actions: list_areas, get_area, create_area, update_area,
 *          list_goals, get_goal, create_goal, update_goal, list_routines
 *
 * Areas and goals use dynamic service imports (AreaService, GoalService) to
 * avoid pulling heavy Prisma-dependent modules into the base bundle. All nine
 * handlers require runtime.persistencePrisma to be present.
 */

import { AgentExecutionError } from "./agentExecutionError";
import type { ActionRegistry, ActionRuntime } from "./actionRegistry";
import type { AgentExecutionContext, AgentExecutionResult } from "./agentTypes";

type RawParams = Record<string, unknown>;

function requirePrisma(
  runtime: ActionRuntime,
  label: string,
): NonNullable<ActionRuntime["persistencePrisma"]> {
  if (!runtime.persistencePrisma) {
    throw new AgentExecutionError(
      501,
      "NOT_CONFIGURED",
      `${label} not configured`,
      false,
    );
  }
  return runtime.persistencePrisma;
}

export function registerGoalAreaActions(registry: ActionRegistry): void {
  registry.registerRaw(
    "list_areas",
    async (
      _params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Areas");
      const { AreaService } = await import("../../../services/areaService");
      const areas = await new AreaService(prisma).findAll(context.userId);
      return runtime.exec.success("list_areas", true, context, 200, { areas });
    },
  );

  registry.registerRaw(
    "get_area",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Areas");
      const { AreaService } = await import("../../../services/areaService");
      const id = String(params.id ?? "");
      const area = await new AreaService(prisma).findById(context.userId, id);
      if (!area) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND",
          "Area not found",
          false,
        );
      }
      return runtime.exec.success("get_area", true, context, 200, { area });
    },
  );

  registry.registerRaw(
    "create_area",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Areas");
      const { AreaService } = await import("../../../services/areaService");
      const area = await new AreaService(prisma).create(context.userId, {
        name: String(params.name ?? ""),
        description:
          params.description != null ? String(params.description) : null,
      });
      return runtime.exec.success("create_area", false, context, 201, { area });
    },
  );

  registry.registerRaw(
    "update_area",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Areas");
      const { AreaService } = await import("../../../services/areaService");
      const area = await new AreaService(prisma).update(
        context.userId,
        String(params.id ?? ""),
        {
          ...(params.name !== undefined ? { name: String(params.name) } : {}),
          ...(params.description !== undefined
            ? {
                description:
                  params.description != null
                    ? String(params.description)
                    : null,
              }
            : {}),
          ...(params.archived !== undefined
            ? { archived: Boolean(params.archived) }
            : {}),
        },
      );
      if (!area) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND",
          "Area not found",
          false,
        );
      }
      return runtime.exec.success("update_area", false, context, 200, { area });
    },
  );

  registry.registerRaw(
    "list_goals",
    async (
      _params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Goals");
      const { GoalService } = await import("../../../services/goalService");
      const goals = await new GoalService(prisma).findAll(context.userId);
      return runtime.exec.success("list_goals", true, context, 200, { goals });
    },
  );

  registry.registerRaw(
    "get_goal",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Goals");
      const { GoalService } = await import("../../../services/goalService");
      const id = String(params.id ?? "");
      const goal = await new GoalService(prisma).findById(context.userId, id);
      if (!goal) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND",
          "Goal not found",
          false,
        );
      }
      return runtime.exec.success("get_goal", true, context, 200, { goal });
    },
  );

  registry.registerRaw(
    "create_goal",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Goals");
      const { GoalService } = await import("../../../services/goalService");
      const goal = await new GoalService(prisma).create(context.userId, {
        name: String(params.name ?? ""),
        description:
          params.description != null ? String(params.description) : null,
        targetDate:
          params.targetDate != null ? String(params.targetDate) : null,
      });
      return runtime.exec.success("create_goal", false, context, 201, { goal });
    },
  );

  registry.registerRaw(
    "update_goal",
    async (
      params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const prisma = requirePrisma(runtime, "Goals");
      const { GoalService } = await import("../../../services/goalService");
      const goal = await new GoalService(prisma).update(
        context.userId,
        String(params.id ?? ""),
        {
          ...(params.name !== undefined ? { name: String(params.name) } : {}),
          ...(params.description !== undefined
            ? {
                description:
                  params.description != null
                    ? String(params.description)
                    : null,
              }
            : {}),
          ...(params.targetDate !== undefined
            ? {
                targetDate:
                  params.targetDate != null ? String(params.targetDate) : null,
              }
            : {}),
          ...(params.archived !== undefined
            ? { archived: Boolean(params.archived) }
            : {}),
        },
      );
      if (!goal) {
        throw new AgentExecutionError(
          404,
          "RESOURCE_NOT_FOUND",
          "Goal not found",
          false,
        );
      }
      return runtime.exec.success("update_goal", false, context, 200, { goal });
    },
  );

  registry.registerRaw(
    "list_routines",
    async (
      _params: RawParams,
      context: AgentExecutionContext,
      runtime: ActionRuntime,
    ): Promise<AgentExecutionResult> => {
      const { detectRoutines } =
        await import("../../../services/routineDetectionService");
      const tasks = await runtime.agentService.listTasks(context.userId, {
        archived: false,
        limit: 500,
      });
      const routines = detectRoutines(tasks);
      return runtime.exec.success("list_routines", true, context, 200, {
        routines,
      });
    },
  );
}
