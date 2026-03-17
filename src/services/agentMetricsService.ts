import { PrismaClient } from "@prisma/client";

export interface MetricEventRecord {
  id: string;
  jobName: string;
  periodKey: string;
  metricType: string;
  entityType: string | null;
  entityId: string | null;
  value: number;
  metadata: unknown;
  recordedAt: Date;
}

export interface MetricSummaryEntry {
  metricType: string;
  count: number;
  total: number;
  avg: number;
  min: number;
  max: number;
}

export class AgentMetricsService {
  constructor(private readonly prisma?: PrismaClient) {}

  async record(
    userId: string,
    event: {
      jobName: string;
      periodKey: string;
      metricType: string;
      entityType?: string;
      entityId?: string;
      value?: number;
      metadata?: unknown;
    },
  ): Promise<MetricEventRecord> {
    if (!this.prisma) {
      return this.mockRecord(event);
    }
    const created = await this.prisma.agentMetricEvent.create({
      data: {
        userId,
        jobName: event.jobName,
        periodKey: event.periodKey,
        metricType: event.metricType,
        entityType: event.entityType ?? null,
        entityId: event.entityId ?? null,
        value: event.value ?? 1,
        metadata:
          (event.metadata as import("@prisma/client").Prisma.InputJsonValue) ??
          undefined,
      },
    });
    return this.toRecord(created);
  }

  async list(
    userId: string,
    filters: {
      jobName?: string;
      metricType?: string;
      periodKey?: string;
      limit?: number;
    },
  ): Promise<MetricEventRecord[]> {
    if (!this.prisma) return [];
    const events = await this.prisma.agentMetricEvent.findMany({
      where: {
        userId,
        ...(filters.jobName ? { jobName: filters.jobName } : {}),
        ...(filters.metricType ? { metricType: filters.metricType } : {}),
        ...(filters.periodKey ? { periodKey: filters.periodKey } : {}),
      },
      orderBy: { recordedAt: "desc" },
      take: filters.limit ?? 100,
    });
    return events.map((e) => this.toRecord(e));
  }

  async summary(
    userId: string,
    filters: { jobName?: string; since?: string },
  ): Promise<MetricSummaryEntry[]> {
    if (!this.prisma) return [];
    const where: import("@prisma/client").Prisma.AgentMetricEventWhereInput = {
      userId,
      ...(filters.jobName ? { jobName: filters.jobName } : {}),
      ...(filters.since
        ? { recordedAt: { gte: new Date(filters.since) } }
        : {}),
    };
    const rows = await this.prisma.agentMetricEvent.findMany({
      where,
      select: { metricType: true, value: true },
    });

    const grouped = new Map<
      string,
      { count: number; total: number; min: number; max: number }
    >();
    for (const row of rows) {
      const entry = grouped.get(row.metricType) ?? {
        count: 0,
        total: 0,
        min: Infinity,
        max: -Infinity,
      };
      entry.count++;
      entry.total += row.value;
      entry.min = Math.min(entry.min, row.value);
      entry.max = Math.max(entry.max, row.value);
      grouped.set(row.metricType, entry);
    }

    return Array.from(grouped.entries()).map(([metricType, s]) => ({
      metricType,
      count: s.count,
      total: s.total,
      avg: s.count > 0 ? s.total / s.count : 0,
      min: s.min === Infinity ? 0 : s.min,
      max: s.max === -Infinity ? 0 : s.max,
    }));
  }

  private mockRecord(event: {
    jobName: string;
    periodKey: string;
    metricType: string;
    entityType?: string;
    entityId?: string;
    value?: number;
    metadata?: unknown;
  }): MetricEventRecord {
    return {
      id: "",
      jobName: event.jobName,
      periodKey: event.periodKey,
      metricType: event.metricType,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      value: event.value ?? 1,
      metadata: event.metadata ?? null,
      recordedAt: new Date(),
    };
  }

  private toRecord(
    e: import("@prisma/client").AgentMetricEvent,
  ): MetricEventRecord {
    return {
      id: e.id,
      jobName: e.jobName,
      periodKey: e.periodKey,
      metricType: e.metricType,
      entityType: e.entityType,
      entityId: e.entityId,
      value: e.value,
      metadata: e.metadata,
      recordedAt: e.recordedAt,
    };
  }
}
