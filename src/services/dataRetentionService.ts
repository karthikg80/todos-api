import { PrismaClient } from "@prisma/client";

/**
 * Data retention service — auto-purge old activity events, insights, and metrics.
 */
export class DataRetentionService {
  constructor(private readonly prisma: PrismaClient) {}

  async purgeOldActivityEvents(olderThanDays = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.activityEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  }

  async purgeOldInsights(olderThanDays = 365): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.userInsight.deleteMany({
      where: { computedAt: { lt: cutoff } },
    });
    return result.count;
  }

  async purgeOldMetricEvents(olderThanDays = 180): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const result = await this.prisma.agentMetricEvent.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    });
    return result.count;
  }

  async purgeAll(): Promise<{
    activityEvents: number;
    insights: number;
    metricEvents: number;
  }> {
    const [activityEvents, insights, metricEvents] = await Promise.all([
      this.purgeOldActivityEvents(),
      this.purgeOldInsights(),
      this.purgeOldMetricEvents(),
    ]);
    return { activityEvents, insights, metricEvents };
  }
}
