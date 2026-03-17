import { PrismaClient } from "@prisma/client";

export interface AgentConfigRecord {
  id: string;
  userId: string;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  inboxEnabled: boolean;
  watchdogEnabled: boolean;
  decomposerEnabled: boolean;
  autoApply: boolean;
  maxWriteActionsPerRun: number;
  inboxConfidenceThreshold: number;
  staleThresholdDays: number;
  waitingFollowUpDays: number;
  plannerWeightPriority: number;
  plannerWeightDueDate: number;
  plannerWeightEnergyMatch: number;
  plannerWeightEstimateFit: number;
  plannerWeightFreshness: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentConfigUpdate = Partial<
  Omit<AgentConfigRecord, "id" | "userId" | "createdAt" | "updatedAt">
>;

export class AgentConfigService {
  constructor(private readonly prisma?: PrismaClient) {}

  async getConfig(userId: string): Promise<AgentConfigRecord> {
    if (!this.prisma) {
      return this.defaultConfig(userId);
    }
    const existing = await this.prisma.agentConfig.findUnique({
      where: { userId },
    });
    if (existing) return this.toRecord(existing);

    // Upsert defaults on first access
    const created = await this.prisma.agentConfig.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.toRecord(created);
  }

  async updateConfig(
    userId: string,
    update: AgentConfigUpdate,
  ): Promise<AgentConfigRecord> {
    if (!this.prisma) {
      return { ...this.defaultConfig(userId), ...update };
    }
    const record = await this.prisma.agentConfig.upsert({
      where: { userId },
      create: { userId, ...update },
      update,
    });
    return this.toRecord(record);
  }

  private defaultConfig(userId: string): AgentConfigRecord {
    const now = new Date();
    return {
      id: "",
      userId,
      dailyEnabled: true,
      weeklyEnabled: true,
      inboxEnabled: true,
      watchdogEnabled: true,
      decomposerEnabled: true,
      autoApply: false,
      maxWriteActionsPerRun: 20,
      inboxConfidenceThreshold: 0.9,
      staleThresholdDays: 14,
      waitingFollowUpDays: 7,
      plannerWeightPriority: 1.0,
      plannerWeightDueDate: 1.0,
      plannerWeightEnergyMatch: 1.0,
      plannerWeightEstimateFit: 1.0,
      plannerWeightFreshness: 1.0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toRecord(r: import("@prisma/client").AgentConfig): AgentConfigRecord {
    return {
      id: r.id,
      userId: r.userId,
      dailyEnabled: r.dailyEnabled,
      weeklyEnabled: r.weeklyEnabled,
      inboxEnabled: r.inboxEnabled,
      watchdogEnabled: r.watchdogEnabled,
      decomposerEnabled: r.decomposerEnabled,
      autoApply: r.autoApply,
      maxWriteActionsPerRun: r.maxWriteActionsPerRun,
      inboxConfidenceThreshold: r.inboxConfidenceThreshold,
      staleThresholdDays: r.staleThresholdDays,
      waitingFollowUpDays: r.waitingFollowUpDays,
      plannerWeightPriority: r.plannerWeightPriority,
      plannerWeightDueDate: r.plannerWeightDueDate,
      plannerWeightEnergyMatch: r.plannerWeightEnergyMatch,
      plannerWeightEstimateFit: r.plannerWeightEstimateFit,
      plannerWeightFreshness: r.plannerWeightFreshness,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }
}
