import { PrismaClient } from "@prisma/client";

/**
 * Exports all user data as a single JSON object (GDPR-style data portability).
 * Excludes password hashes and internal infrastructure IDs.
 */
export class DataExportService {
  constructor(private readonly prisma: PrismaClient) {}

  async exportAllUserData(userId: string): Promise<Record<string, unknown>> {
    const [
      user,
      todos,
      projects,
      areas,
      goals,
      captures,
      events,
      insights,
      preferences,
      config,
      dayContexts,
      feedback,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          isVerified: true,
          onboardingStep: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.todo.findMany({ where: { userId } }),
      this.prisma.project.findMany({ where: { userId } }),
      this.prisma.area.findMany({ where: { userId } }),
      this.prisma.goal.findMany({ where: { userId } }),
      this.prisma.captureItem.findMany({ where: { userId } }),
      this.prisma.activityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 1000,
      }),
      this.prisma.userInsight.findMany({ where: { userId } }),
      this.prisma.userPlanningPreferences.findUnique({ where: { userId } }),
      this.prisma.agentConfig.findUnique({ where: { userId } }),
      this.prisma.userDayContext.findMany({ where: { userId } }),
      this.prisma.taskRecommendationFeedback.findMany({ where: { userId } }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user,
      todos,
      projects,
      areas,
      goals,
      captureItems: captures,
      activityEvents: events,
      insights,
      planningPreferences: preferences,
      agentConfig: config,
      dayContexts,
      recommendationFeedback: feedback,
    };
  }
}
