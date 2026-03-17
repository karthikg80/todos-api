import { PrismaClient } from "@prisma/client";

export interface JobRunRecord {
  id: string;
  jobName: string;
  periodKey: string;
  status: string;
  retryCount: number;
  claimedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  metadata: unknown;
}

export class AgentJobRunService {
  constructor(private readonly prisma?: PrismaClient) {}

  async claimRun(
    userId: string,
    jobName: string,
    periodKey: string,
  ): Promise<{ claimed: boolean; run: JobRunRecord | null }> {
    if (!this.prisma) {
      return { claimed: true, run: null };
    }

    try {
      const run = await this.prisma.agentJobRun.create({
        data: { userId, jobName, periodKey, status: "running" },
      });
      return { claimed: true, run: this.toRecord(run) };
    } catch (err: unknown) {
      // Unique constraint violation means already claimed
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        return { claimed: false, run: null };
      }
      throw err;
    }
  }

  async completeRun(
    userId: string,
    jobName: string,
    periodKey: string,
    metadata?: unknown,
  ): Promise<boolean> {
    if (!this.prisma) return true;
    const result = await this.prisma.agentJobRun.updateMany({
      where: { userId, jobName, periodKey },
      data: {
        status: "completed",
        completedAt: new Date(),
        metadata: metadata as import("@prisma/client").Prisma.InputJsonValue,
      },
    });
    return result.count > 0;
  }

  async failRun(
    userId: string,
    jobName: string,
    periodKey: string,
    errorMessage: string,
  ): Promise<boolean> {
    if (!this.prisma) return true;
    const result = await this.prisma.agentJobRun.updateMany({
      where: { userId, jobName, periodKey },
      data: {
        status: "failed",
        failedAt: new Date(),
        errorMessage: errorMessage.slice(0, 500),
      },
    });
    return result.count > 0;
  }

  async getRunStatus(
    userId: string,
    jobName: string,
    periodKey: string,
  ): Promise<JobRunRecord | null> {
    if (!this.prisma) return null;
    const run = await this.prisma.agentJobRun.findUnique({
      where: { userId_jobName_periodKey: { userId, jobName, periodKey } },
    });
    return run ? this.toRecord(run) : null;
  }

  async replayRun(
    userId: string,
    jobName: string,
    periodKey: string,
  ): Promise<{ replayed: boolean; run: JobRunRecord | null }> {
    if (!this.prisma) {
      return { replayed: true, run: null };
    }
    const existing = await this.prisma.agentJobRun.findUnique({
      where: { userId_jobName_periodKey: { userId, jobName, periodKey } },
    });
    if (!existing) {
      return { replayed: false, run: null };
    }
    const updated = await this.prisma.agentJobRun.update({
      where: { userId_jobName_periodKey: { userId, jobName, periodKey } },
      data: {
        status: "running",
        completedAt: null,
        failedAt: null,
        errorMessage: null,
        retryCount: { increment: 1 },
      },
    });
    return { replayed: true, run: this.toRecord(updated) };
  }

  async listRuns(
    userId: string,
    filters: { jobName?: string; status?: string; limit?: number },
  ): Promise<JobRunRecord[]> {
    if (!this.prisma) return [];
    const runs = await this.prisma.agentJobRun.findMany({
      where: {
        userId,
        ...(filters.jobName ? { jobName: filters.jobName } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { claimedAt: "desc" },
      take: filters.limit ?? 50,
    });
    return runs.map((r) => this.toRecord(r));
  }

  private toRecord(run: import("@prisma/client").AgentJobRun): JobRunRecord {
    return {
      id: run.id,
      jobName: run.jobName,
      periodKey: run.periodKey,
      status: run.status,
      retryCount: run.retryCount,
      claimedAt: run.claimedAt,
      completedAt: run.completedAt,
      failedAt: run.failedAt,
      errorMessage: run.errorMessage,
      metadata: run.metadata,
    };
  }
}
