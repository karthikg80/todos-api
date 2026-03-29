/**
 * DayPlanService
 *
 * Manages the Today Plan — the flagship feature of the execution intelligence platform.
 * A DayPlan is a defended, date-specific commitment of tasks the user will work on.
 *
 * Responsibilities:
 * - Create/retrieve today's plan
 * - Populate from plan_today AI output (createFromPlan)
 * - Add/remove/reorder tasks within a plan
 * - Track task outcomes (completed/deferred/removed)
 * - Finalize a plan (lock it, auto-defer pending tasks)
 * - Generate end-of-day review (committed vs actual)
 */

import {
  PrismaClient,
  DayPlanStatus,
  DayPlanTaskOutcome,
  Prisma,
  type Prisma as PrismaTypes,
} from "@prisma/client";

type JsonInput = PrismaTypes.InputJsonValue | typeof Prisma.JsonNull;
import { ITodoService } from "../interfaces/ITodoService";
import { Todo } from "../types";

// ── Domain errors ──

export const PLAN_NOT_FOUND = "PLAN_NOT_FOUND";
export const PLAN_ALREADY_FINALIZED = "PLAN_ALREADY_FINALIZED";
export const TASK_ALREADY_IN_PLAN = "TASK_ALREADY_IN_PLAN";

/**
 * Shared Prisma include for fetching a DayPlan with its tasks and
 * each task's full todo (with project + subtasks). Defined once to
 * avoid duplication across query methods.
 */
const PLAN_WITH_TASKS_INCLUDE = {
  tasks: {
    orderBy: { order: "asc" as const },
    include: {
      todo: {
        include: {
          project: true,
          subtasks: { orderBy: { order: "asc" as const } },
        },
      },
    },
  },
} satisfies Prisma.DayPlanInclude;

// ── DTOs ──

export interface DayPlanDto {
  id: string;
  userId: string;
  date: string;
  status: DayPlanStatus;
  mode: string;
  energyLevel: string | null;
  availableMinutes: number | null;
  totalMinutes: number | null;
  remainingMinutes: number | null;
  headline: Record<string, unknown> | null;
  budgetBreakdown: Record<string, unknown> | null;
  decisionRunId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  reviewedAt: string | null;
  tasks: DayPlanTaskDto[];
}

export interface DayPlanTaskDto {
  id: string;
  planId: string;
  todoId: string;
  order: number;
  committed: boolean;
  outcome: DayPlanTaskOutcome;
  estimatedMinutes: number | null;
  score: number | null;
  explanation: Record<string, unknown> | null;
  attribution: Record<string, unknown> | null;
  manuallyAdded: boolean;
  todo?: Todo;
}

export interface CreateDayPlanDto {
  date: string; // ISO date string (YYYY-MM-DD)
  energyLevel?: string;
  notes?: string;
  todoIds?: string[]; // initial tasks to add
}

export interface CreateFromPlanInput {
  planDate: string;
  mode?: string;
  energy?: string | null;
  availableMinutes?: number;
  totalMinutes?: number;
  remainingMinutes?: number;
  headline?: Record<string, unknown>;
  budgetBreakdown?: Record<string, unknown>;
  decisionRunId?: string | null;
  recommendedTasks: Array<{
    id: string;
    estimatedMinutes?: number;
    score?: number;
    explanation?: Record<string, unknown>;
    attribution?: Record<string, unknown>;
  }>;
}

export interface UpdateDayPlanDto {
  energyLevel?: string | null;
  notes?: string | null;
}

export interface AddPlanTaskDto {
  todoId: string;
  order?: number;
  estimatedMinutes?: number;
}

export interface DayPlanReview {
  planId: string;
  date: string;
  status: DayPlanStatus;
  totalCommitted: number;
  totalCompleted: number;
  totalDeferred: number;
  totalRemoved: number;
  manuallyAddedCount: number;
  completionRate: number;
  tasks: Array<{
    todoId: string;
    title: string;
    committed: boolean;
    outcome: DayPlanTaskOutcome;
    manuallyAdded: boolean;
  }>;
}

export class DayPlanService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly todoService: ITodoService,
  ) {}

  /**
   * Get or create today's plan for a user.
   */
  async getOrCreateToday(userId: string): Promise<DayPlanDto> {
    const today = this.todayDateString();
    const todayDate = new Date(today + "T00:00:00.000Z");

    let plan = await this.prisma.dayPlan.findUnique({
      where: { userId_date: { userId, date: todayDate } },
      include: PLAN_WITH_TASKS_INCLUDE,
    });

    if (!plan) {
      plan = await this.prisma.dayPlan.create({
        data: {
          userId,
          date: todayDate,
          status: "draft",
        },
        include: PLAN_WITH_TASKS_INCLUDE,
      });
    }

    return this.mapToDto(plan);
  }

  /**
   * Populate a DayPlan from the plan_today agent output.
   * Upserts: if a plan already exists for the date, replaces its tasks.
   */
  async createFromPlan(
    userId: string,
    input: CreateFromPlanInput,
  ): Promise<DayPlanDto> {
    const planDate = new Date(input.planDate + "T00:00:00.000Z");

    return this.prisma.$transaction(async (tx) => {
      // Find existing plan for this date
      const existing = await tx.dayPlan.findUnique({
        where: { userId_date: { userId, date: planDate } },
        select: { id: true },
      });

      // Delete old tasks if replacing
      if (existing) {
        await tx.dayPlanTask.deleteMany({ where: { planId: existing.id } });
      }

      // Upsert the plan
      const plan = await tx.dayPlan.upsert({
        where: { userId_date: { userId, date: planDate } },
        create: {
          userId,
          date: planDate,
          status: "active",
          mode: input.mode ?? "normal",
          energyLevel: input.energy ?? null,
          availableMinutes: input.availableMinutes ?? null,
          totalMinutes: input.totalMinutes ?? null,
          remainingMinutes: input.remainingMinutes ?? null,
          headline: (input.headline ?? Prisma.JsonNull) as JsonInput,
          budgetBreakdown: (input.budgetBreakdown ??
            Prisma.JsonNull) as JsonInput,
          decisionRunId: input.decisionRunId ?? null,
        },
        update: {
          status: "active",
          mode: input.mode ?? "normal",
          energyLevel: input.energy ?? null,
          availableMinutes: input.availableMinutes ?? null,
          totalMinutes: input.totalMinutes ?? null,
          remainingMinutes: input.remainingMinutes ?? null,
          headline: (input.headline ?? Prisma.JsonNull) as JsonInput,
          budgetBreakdown: (input.budgetBreakdown ??
            Prisma.JsonNull) as JsonInput,
          decisionRunId: input.decisionRunId ?? null,
        },
      });

      // Create tasks from recommended list
      if (input.recommendedTasks.length > 0) {
        await tx.dayPlanTask.createMany({
          data: input.recommendedTasks.map((task, index) => ({
            planId: plan.id,
            todoId: task.id,
            order: index,
            committed: true,
            outcome: "pending" as DayPlanTaskOutcome,
            estimatedMinutes: task.estimatedMinutes ?? null,
            score: task.score ?? null,
            explanation: (task.explanation ?? Prisma.JsonNull) as JsonInput,
            attribution: (task.attribution ?? Prisma.JsonNull) as JsonInput,
            manuallyAdded: false,
          })),
          skipDuplicates: true,
        });
      }

      // Fetch the complete plan with tasks
      const result = await tx.dayPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: PLAN_WITH_TASKS_INCLUDE,
      });

      return this.mapToDto(result);
    });
  }

  /**
   * Get a plan for a specific date.
   */
  async getByDate(userId: string, date: string): Promise<DayPlanDto | null> {
    const planDate = new Date(date + "T00:00:00.000Z");
    const plan = await this.prisma.dayPlan.findUnique({
      where: { userId_date: { userId, date: planDate } },
      include: PLAN_WITH_TASKS_INCLUDE,
    });

    return plan ? this.mapToDto(plan) : null;
  }

  /**
   * Update plan metadata (energy level, notes).
   */
  async update(
    userId: string,
    planId: string,
    dto: UpdateDayPlanDto,
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;

    const updated = await this.prisma.dayPlan.update({
      where: { id: planId },
      data: {
        ...(dto.energyLevel !== undefined && { energyLevel: dto.energyLevel }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: PLAN_WITH_TASKS_INCLUDE,
    });

    return this.mapToDto(updated);
  }

  /**
   * Add a task to a plan. Sets manuallyAdded = true.
   */
  async addTask(
    userId: string,
    planId: string,
    dto: AddPlanTaskDto,
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;
    if (plan.status === "reviewed" || plan.status === "abandoned") return null;

    // Verify user owns the todo
    const todo = await this.todoService.findById(userId, dto.todoId);
    if (!todo) return null;

    // Get next order
    const maxOrder = await this.prisma.dayPlanTask.findFirst({
      where: { planId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    const nextOrder = dto.order ?? (maxOrder?.order ?? -1) + 1;

    await this.prisma.dayPlanTask.upsert({
      where: { planId_todoId: { planId, todoId: dto.todoId } },
      create: {
        planId,
        todoId: dto.todoId,
        order: nextOrder,
        committed: true,
        outcome: "pending",
        estimatedMinutes: dto.estimatedMinutes ?? null,
        manuallyAdded: true,
      },
      update: {
        order: nextOrder,
        committed: true,
        outcome: "pending",
        manuallyAdded: true,
      },
    });

    return this.getByPlanId(userId, planId);
  }

  /**
   * Remove a task from a plan (soft delete — sets outcome to removed).
   */
  async removeTask(
    userId: string,
    planId: string,
    todoId: string,
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;

    await this.prisma.dayPlanTask.updateMany({
      where: { planId, todoId },
      data: { outcome: "removed", committed: false },
    });

    return this.getByPlanId(userId, planId);
  }

  /**
   * Reorder tasks within a plan.
   */
  async reorderTasks(
    userId: string,
    planId: string,
    taskOrders: Array<{ todoId: string; order: number }>,
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;

    await this.prisma.$transaction(
      taskOrders.map((item) =>
        this.prisma.dayPlanTask.updateMany({
          where: { planId, todoId: item.todoId },
          data: { order: item.order },
        }),
      ),
    );

    return this.getByPlanId(userId, planId);
  }

  /**
   * Update a task's outcome (completed or deferred).
   */
  async updateTaskOutcome(
    userId: string,
    planId: string,
    todoId: string,
    outcome: "completed" | "deferred",
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;

    await this.prisma.dayPlanTask.updateMany({
      where: { planId, todoId },
      data: { outcome },
    });

    return this.getByPlanId(userId, planId);
  }

  /**
   * Finalize a plan — signals the user is done for the day.
   * All still-pending committed tasks are marked as deferred.
   */
  async finalize(userId: string, planId: string): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;
    if (plan.status === "finalized" || plan.status === "reviewed") return null;

    return this.prisma.$transaction(async (tx) => {
      // Auto-defer all pending committed tasks
      await tx.dayPlanTask.updateMany({
        where: {
          planId,
          committed: true,
          outcome: "pending",
        },
        data: { outcome: "deferred" },
      });

      const updated = await tx.dayPlan.update({
        where: { id: planId },
        data: {
          status: "finalized",
          finalizedAt: new Date(),
        },
        include: PLAN_WITH_TASKS_INCLUDE,
      });

      return this.mapToDto(updated);
    });
  }

  /**
   * Abandon a plan.
   */
  async abandon(userId: string, planId: string): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;

    const updated = await this.prisma.dayPlan.update({
      where: { id: planId },
      data: { status: "abandoned" },
      include: PLAN_WITH_TASKS_INCLUDE,
    });

    return this.mapToDto(updated);
  }

  /**
   * Generate an end-of-day review comparing plan vs reality.
   */
  async review(userId: string, planId: string): Promise<DayPlanReview | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
      include: {
        tasks: { orderBy: { order: "asc" } },
      },
    });
    if (!plan) return null;

    // Sync completion status from actual todos
    const reviewTasks = [];
    for (const planTask of plan.tasks) {
      const todo = await this.todoService.findById(userId, planTask.todoId);
      const actuallyCompleted = todo?.completed ?? false;

      // Sync outcome with actual todo completion state
      if (actuallyCompleted && planTask.outcome === "pending") {
        await this.prisma.dayPlanTask.update({
          where: { id: planTask.id },
          data: { outcome: "completed" },
        });
      }

      reviewTasks.push({
        todoId: planTask.todoId,
        title: todo?.title ?? "(deleted)",
        committed: planTask.committed,
        outcome: actuallyCompleted
          ? ("completed" as DayPlanTaskOutcome)
          : planTask.outcome,
        manuallyAdded: planTask.manuallyAdded,
      });
    }

    const committed = reviewTasks.filter((t) => t.committed);
    const totalCommitted = committed.length;
    const totalCompleted = reviewTasks.filter(
      (t) => t.outcome === "completed",
    ).length;
    const totalDeferred = reviewTasks.filter(
      (t) => t.outcome === "deferred",
    ).length;
    const totalRemoved = reviewTasks.filter(
      (t) => t.outcome === "removed",
    ).length;
    const manuallyAddedCount = reviewTasks.filter(
      (t) => t.manuallyAdded,
    ).length;

    // Mark plan as reviewed
    await this.prisma.dayPlan.update({
      where: { id: planId },
      data: {
        status: "reviewed",
        reviewedAt: new Date(),
      },
    });

    return {
      planId: plan.id,
      date: plan.date.toISOString().split("T")[0],
      status: "reviewed",
      totalCommitted,
      totalCompleted,
      totalDeferred,
      totalRemoved,
      manuallyAddedCount,
      completionRate:
        totalCommitted > 0
          ? Math.round((totalCompleted / totalCommitted) * 100)
          : 0,
      tasks: reviewTasks,
    };
  }

  /**
   * Get plan history for learning loop.
   */
  async getHistory(userId: string, limit: number = 14): Promise<DayPlanDto[]> {
    const plans = await this.prisma.dayPlan.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: limit,
      include: PLAN_WITH_TASKS_INCLUDE,
    });

    return plans.map((plan) => this.mapToDto(plan));
  }

  // ── Private helpers ──

  private async getByPlanId(
    userId: string,
    planId: string,
  ): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
      include: PLAN_WITH_TASKS_INCLUDE,
    });
    return plan ? this.mapToDto(plan) : null;
  }

  private todayDateString(): string {
    return new Date().toISOString().split("T")[0];
  }

  private mapToDto(plan: any): DayPlanDto {
    return {
      id: plan.id,
      userId: plan.userId,
      date:
        plan.date instanceof Date
          ? plan.date.toISOString().split("T")[0]
          : plan.date,
      status: plan.status,
      mode: plan.mode ?? "normal",
      energyLevel: plan.energyLevel,
      availableMinutes: plan.availableMinutes ?? null,
      totalMinutes: plan.totalMinutes ?? null,
      remainingMinutes: plan.remainingMinutes ?? null,
      headline: plan.headline as Record<string, unknown> | null,
      budgetBreakdown: plan.budgetBreakdown as Record<string, unknown> | null,
      decisionRunId: plan.decisionRunId ?? null,
      notes: plan.notes,
      createdAt:
        plan.createdAt instanceof Date
          ? plan.createdAt.toISOString()
          : plan.createdAt,
      updatedAt:
        plan.updatedAt instanceof Date
          ? plan.updatedAt.toISOString()
          : plan.updatedAt,
      finalizedAt: plan.finalizedAt
        ? plan.finalizedAt instanceof Date
          ? plan.finalizedAt.toISOString()
          : plan.finalizedAt
        : null,
      reviewedAt: plan.reviewedAt
        ? plan.reviewedAt instanceof Date
          ? plan.reviewedAt.toISOString()
          : plan.reviewedAt
        : null,
      tasks: (plan.tasks || []).map((task: any) => this.mapTaskToDto(task)),
    };
  }

  private mapTaskToDto(task: any): DayPlanTaskDto {
    const dto: DayPlanTaskDto = {
      id: task.id,
      planId: task.planId,
      todoId: task.todoId,
      order: task.order,
      committed: task.committed,
      outcome: task.outcome ?? "pending",
      estimatedMinutes: task.estimatedMinutes ?? null,
      score: task.score ?? null,
      explanation: task.explanation as Record<string, unknown> | null,
      attribution: task.attribution as Record<string, unknown> | null,
      manuallyAdded: task.manuallyAdded ?? false,
    };
    if (task.todo) {
      dto.todo = {
        id: task.todo.id,
        title: task.todo.title,
        description: task.todo.description ?? undefined,
        status: task.todo.status,
        completed: task.todo.completed,
        projectId: task.todo.projectId ?? undefined,
        category: task.todo.project?.name ?? task.todo.category ?? undefined,
        tags: task.todo.tags ?? [],
        priority: task.todo.priority || "medium",
        dueDate: task.todo.dueDate ?? undefined,
        estimateMinutes: task.todo.estimateMinutes ?? undefined,
        order: task.todo.order,
        archived: task.todo.archived,
        dependsOnTaskIds: task.todo.dependsOnTaskIds ?? [],
        recurrence: {
          type: task.todo.recurrenceType ?? "none",
        },
        userId: task.todo.userId,
        createdAt: task.todo.createdAt,
        updatedAt: task.todo.updatedAt,
      };
    }
    return dto;
  }
}
