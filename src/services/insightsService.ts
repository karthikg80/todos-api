import {
  InsightType,
  InsightPeriodType,
  PrismaClient,
  UserInsight,
} from "@prisma/client";

export interface InsightRecord {
  insightType: InsightType;
  periodType: InsightPeriodType;
  periodStart: Date;
  value: number;
  metadata: unknown;
  computedAt: Date;
}

export interface InsightTrendPoint {
  periodStart: Date;
  value: number;
}

export interface GetInsightsOpts {
  periodType?: InsightPeriodType;
  insightType?: InsightType;
}

export class InsightsService {
  constructor(private readonly prisma?: PrismaClient) {}

  /**
   * Get the latest insights for a user, optionally filtered.
   */
  async getInsights(
    userId: string,
    opts?: GetInsightsOpts,
  ): Promise<InsightRecord[]> {
    if (!this.prisma) return [];

    const where: {
      userId: string;
      periodType?: InsightPeriodType;
      insightType?: InsightType;
    } = { userId };
    if (opts?.periodType) where.periodType = opts.periodType;
    if (opts?.insightType) where.insightType = opts.insightType;

    const insights = await this.prisma.userInsight.findMany({
      where,
      orderBy: { computedAt: "desc" },
    });

    // Deduplicate: keep only the latest per insightType+periodType
    const seen = new Set<string>();
    const result: InsightRecord[] = [];
    for (const i of insights) {
      const key = `${i.insightType}:${i.periodType}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({
          insightType: i.insightType,
          periodType: i.periodType,
          periodStart: i.periodStart,
          value: i.value,
          metadata: i.metadata,
          computedAt: i.computedAt,
        });
      }
    }

    return result;
  }

  /**
   * Get time-series trend data for a specific insight type.
   */
  async getInsightTrend(
    userId: string,
    insightType: InsightType,
    periods: number = 7,
  ): Promise<InsightTrendPoint[]> {
    if (!this.prisma) return [];

    const insights = await this.prisma.userInsight.findMany({
      where: { userId, insightType },
      orderBy: { periodStart: "desc" },
      take: periods,
      select: { periodStart: true, value: true },
    });

    return insights
      .map((i) => ({
        periodStart: i.periodStart,
        value: i.value,
      }))
      .reverse();
  }

  /**
   * Get project health scores from the latest insights.
   */
  async getProjectHealthScores(userId: string): Promise<
    Array<{
      projectId: string;
      projectName: string;
      score: number;
      status: string;
      breakdown: unknown;
    }>
  > {
    if (!this.prisma) return [];

    const healthInsights = await this.prisma.userInsight.findMany({
      where: {
        userId,
        insightType: "project_health",
      },
      orderBy: { computedAt: "desc" },
    });

    return healthInsights
      .filter(
        (i): i is UserInsight & { metadata: Record<string, unknown> } =>
          i.metadata !== null && typeof i.metadata === "object",
      )
      .map((i) => {
        const meta = i.metadata as Record<string, unknown>;
        return {
          projectId: String(meta.projectId ?? ""),
          projectName: String(meta.projectName ?? ""),
          score: i.value,
          status: String(meta.status ?? "unknown"),
          breakdown: meta.breakdown ?? null,
        };
      });
  }
}
