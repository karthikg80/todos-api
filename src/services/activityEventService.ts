import {
  ActivityEventType,
  Prisma,
  PrismaClient,
  ActivityEvent,
} from "@prisma/client";
import { createLogger } from "../infra/logging/logger";

const log = createLogger("activityEventService");

const VALID_EVENT_TYPES = new Set<string>(
  Object.values({
    task_created: "task_created",
    task_completed: "task_completed",
    task_uncompleted: "task_uncompleted",
    task_deleted: "task_deleted",
    task_updated: "task_updated",
    task_status_changed: "task_status_changed",
    project_created: "project_created",
    project_archived: "project_archived",
    subtask_completed: "subtask_completed",
    filter_used: "filter_used",
    bulk_action: "bulk_action",
    session_start: "session_start",
  } satisfies Record<ActivityEventType, string>),
);

const MAX_BATCH_SIZE = 50;

export interface RecordEventOpts {
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface BatchEventInput {
  eventType: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export interface FindEventsOpts {
  eventType?: ActivityEventType;
  since?: Date;
  until?: Date;
  limit?: number;
}

export class ActivityEventService {
  constructor(private readonly prisma?: PrismaClient) {}

  /**
   * Fire-and-forget event recording. Never blocks the caller, never throws.
   */
  recordEvent(
    userId: string,
    eventType: ActivityEventType,
    opts?: RecordEventOpts,
  ): void {
    if (!this.prisma) return;

    this.prisma.activityEvent
      .create({
        data: {
          userId,
          eventType,
          entityType: opts?.entityType ?? null,
          entityId: opts?.entityId ?? null,
          metadata:
            (opts?.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        },
      })
      .catch((err) => {
        log.warn("Non-fatal: failed to record activity event", {
          eventType,
          error: (err as Error).message,
        });
      });
  }

  /**
   * Batch-create events from client-side flush. Returns the number of created events.
   * Validates event types and enforces MAX_BATCH_SIZE.
   */
  async batchCreate(
    userId: string,
    events: BatchEventInput[],
  ): Promise<number> {
    if (!this.prisma) return 0;
    if (!events.length) return 0;

    const validEvents = events.slice(0, MAX_BATCH_SIZE).filter((e) => {
      if (!VALID_EVENT_TYPES.has(e.eventType)) {
        log.warn("Skipping invalid event type in batch", {
          eventType: e.eventType,
        });
        return false;
      }
      return true;
    });

    if (!validEvents.length) return 0;

    const result = await this.prisma.activityEvent.createMany({
      data: validEvents.map((e) => ({
        userId,
        eventType: e.eventType as ActivityEventType,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        metadata:
          (e.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
      })),
    });

    return result.count;
  }

  /**
   * Query events for a user with optional filters.
   */
  async findByUser(
    userId: string,
    opts?: FindEventsOpts,
  ): Promise<ActivityEvent[]> {
    if (!this.prisma) return [];

    const where: Prisma.ActivityEventWhereInput = { userId };
    if (opts?.eventType) where.eventType = opts.eventType;
    if (opts?.since || opts?.until) {
      where.createdAt = {};
      if (opts?.since) where.createdAt.gte = opts.since;
      if (opts?.until) where.createdAt.lte = opts.until;
    }

    return this.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 200,
    });
  }

  /**
   * Count events grouped by event type within a time range.
   */
  async countByType(
    userId: string,
    since: Date,
    until: Date,
  ): Promise<Record<string, number>> {
    if (!this.prisma) return {};

    const groups = await this.prisma.activityEvent.groupBy({
      by: ["eventType"],
      where: {
        userId,
        createdAt: { gte: since, lte: until },
      },
      _count: { id: true },
    });

    const result: Record<string, number> = {};
    for (const g of groups) {
      result[g.eventType] = g._count.id;
    }
    return result;
  }
}
