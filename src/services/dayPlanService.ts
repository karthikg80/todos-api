/**
 * DayPlanService
 *
 * Manages the Today Plan — the flagship feature of the execution intelligence platform.
 * A DayPlan is a defended, date-specific commitment of tasks the user will work on.
 *
 * Responsibilities:
 * - Create/retrieve today's plan
 * - Add/remove/reorder tasks within a plan
 * - Finalize a plan (lock it for execution)
 * - Generate end-of-day review (committed vs actual)
 * - Auto-generate plan from AI prioritization
 */

import { PrismaClient, DayPlanStatus } from "@prisma/client";
import { ITodoService } from "../interfaces/ITodoService";
import { Todo } from "../types";

export interface DayPlanDto {
  id: string;
  userId: string;
  date: string;
  status: DayPlanStatus;
  energyLevel: string | null;
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
  completed: boolean;
  deferred: boolean;
  todo?: Todo;
}

export interface CreateDayPlanDto {
  date: string; // ISO date string (YYYY-MM-DD)
  energyLevel?: string;
  notes?: string;
  todoIds?: string[]; // initial tasks to add
}

export interface UpdateDayPlanDto {
  energyLevel?: string | null;
  notes?: string | null;
}

export interface AddPlanTaskDto {
  todoId: string;
  order?: number;
}

export interface DayPlanReview {
  date: string;
  totalCommitted: number;
  totalCompleted: number;
  totalDeferred: number;
  completionRate: number;
  tasks: Array<{
    todoId: string;
    title: string;
    committed: boolean;
    completed: boolean;
    deferred: boolean;
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
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            todo: {
              include: {
                project: true,
                subtasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!plan) {
      plan = await this.prisma.dayPlan.create({
        data: {
          userId,
          date: todayDate,
          status: "draft",
        },
        include: {
          tasks: {
            orderBy: { order: "asc" },
            include: {
              todo: {
                include: {
                  project: true,
                  subtasks: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      });
    }

    return this.mapToDto(plan);
  }

  /**
   * Get a plan for a specific date.
   */
  async getByDate(userId: string, date: string): Promise<DayPlanDto | null> {
    const planDate = new Date(date + "T00:00:00.000Z");
    const plan = await this.prisma.dayPlan.findUnique({
      where: { userId_date: { userId, date: planDate } },
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            todo: {
              include: {
                project: true,
                subtasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
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
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            todo: {
              include: {
                project: true,
                subtasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
    });

    return this.mapToDto(updated);
  }

  /**
   * Add a task to a plan.
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
    if (plan.status === "reviewed") return null;

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
      },
      update: {
        order: nextOrder,
        committed: true,
        deferred: false,
      },
    });

    return this.getByPlanId(userId, planId);
  }

  /**
   * Remove a task from a plan.
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

    await this.prisma.dayPlanTask.deleteMany({
      where: { planId, todoId },
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
   * Finalize a plan — signals the user is committed to this set of tasks.
   */
  async finalize(userId: string, planId: string): Promise<DayPlanDto | null> {
    const plan = await this.prisma.dayPlan.findFirst({
      where: { id: planId, userId },
    });
    if (!plan) return null;
    if (plan.status !== "draft") return null;

    const updated = await this.prisma.dayPlan.update({
      where: { id: planId },
      data: {
        status: "finalized",
        finalizedAt: new Date(),
      },
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            todo: {
              include: {
                project: true,
                subtasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
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
        tasks: {
          orderBy: { order: "asc" },
        },
      },
    });
    if (!plan) return null;

    // Sync completion status from actual todos
    const reviewTasks = [];
    for (const planTask of plan.tasks) {
      const todo = await this.todoService.findById(userId, planTask.todoId);
      const actuallyCompleted = todo?.completed ?? false;

      // Update the plan task's completed status to match reality
      if (actuallyCompleted !== planTask.completed) {
        await this.prisma.dayPlanTask.update({
          where: { id: planTask.id },
          data: { completed: actuallyCompleted },
        });
      }

      reviewTasks.push({
        todoId: planTask.todoId,
        title: todo?.title ?? "(deleted)",
        committed: planTask.committed,
        completed: actuallyCompleted,
        deferred: planTask.deferred,
      });
    }

    const totalCommitted = reviewTasks.filter((t) => t.committed).length;
    const totalCompleted = reviewTasks.filter((t) => t.completed).length;
    const totalDeferred = reviewTasks.filter((t) => t.deferred).length;

    // Mark plan as reviewed
    await this.prisma.dayPlan.update({
      where: { id: planId },
      data: {
        status: "reviewed",
        reviewedAt: new Date(),
      },
    });

    return {
      date: plan.date.toISOString().split("T")[0],
      totalCommitted,
      totalCompleted,
      totalDeferred,
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
      include: {
        tasks: {
          orderBy: { order: "asc" },
        },
      },
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
      include: {
        tasks: {
          orderBy: { order: "asc" },
          include: {
            todo: {
              include: {
                project: true,
                subtasks: { orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
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
      energyLevel: plan.energyLevel,
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
      completed: task.completed,
      deferred: task.deferred,
    };
    if (task.todo) {
      // Map the included todo to the application Todo type
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
