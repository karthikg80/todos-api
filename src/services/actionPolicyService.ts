import { PrismaClient } from "@prisma/client";

export type BlastRadius =
  | "single_entity"
  | "project_scope"
  | "cross_project"
  | "account_wide";

export interface ActionPolicy {
  autoApply: boolean;
  minConfidence: number;
}

export type ActionPoliciesMap = Record<string, ActionPolicy>;

export interface ActionMeta {
  confidence: number;
  reversible: boolean;
  blastRadius: BlastRadius;
  autoApplied: boolean;
  policyUsed: string;
}

// Static action metadata — confidence and blast radius are intrinsic to the action type.
const ACTION_STATIC_META: Record<
  string,
  { confidence: number; reversible: boolean; blastRadius: BlastRadius }
> = {
  create_follow_up_for_waiting_task: {
    confidence: 0.85,
    reversible: true,
    blastRadius: "single_entity",
  },
  ensure_next_action: {
    confidence: 0.87,
    reversible: false,
    blastRadius: "project_scope",
  },
  triage_capture_item: {
    confidence: 0.9,
    reversible: false,
    blastRadius: "single_entity",
  },
};

// Default per-action policy used when no explicit override is stored.
const DEFAULT_POLICIES: ActionPoliciesMap = {
  create_follow_up_for_waiting_task: { autoApply: true, minConfidence: 0.8 },
  ensure_next_action: { autoApply: true, minConfidence: 0.85 },
  triage_capture_item: { autoApply: true, minConfidence: 0.9 },
  archive_task: { autoApply: false, minConfidence: 1.0 },
};

export class ActionPolicyService {
  constructor(private readonly prisma?: PrismaClient) {}

  async getPolicies(userId: string): Promise<ActionPoliciesMap> {
    if (!this.prisma) return { ...DEFAULT_POLICIES };
    const config = await this.prisma.agentConfig.findUnique({
      where: { userId },
      select: { actionPoliciesJson: true },
    });
    const stored = (config?.actionPoliciesJson ??
      {}) as unknown as ActionPoliciesMap;
    return { ...DEFAULT_POLICIES, ...stored };
  }

  async updatePolicy(
    userId: string,
    actionName: string,
    policy: Partial<ActionPolicy>,
  ): Promise<ActionPoliciesMap> {
    if (!this.prisma) {
      return {
        ...DEFAULT_POLICIES,
        [actionName]: { ...DEFAULT_POLICIES[actionName], ...policy },
      };
    }
    const current = await this.getPolicies(userId);
    const updated: ActionPoliciesMap = {
      ...current,
      [actionName]: {
        autoApply: policy.autoApply ?? current[actionName]?.autoApply ?? false,
        minConfidence:
          policy.minConfidence ?? current[actionName]?.minConfidence ?? 1.0,
      },
    };
    // Persist only the overrides (delta from defaults)
    const overrides: ActionPoliciesMap = {};
    for (const [k, v] of Object.entries(updated)) {
      const def = DEFAULT_POLICIES[k];
      if (
        !def ||
        def.autoApply !== v.autoApply ||
        def.minConfidence !== v.minConfidence
      ) {
        overrides[k] = v;
      }
    }
    await this.prisma.agentConfig.upsert({
      where: { userId },
      create: {
        userId,
        actionPoliciesJson:
          overrides as unknown as import("@prisma/client").Prisma.JsonObject,
      },
      update: {
        actionPoliciesJson:
          overrides as unknown as import("@prisma/client").Prisma.JsonObject,
      },
    });
    return updated;
  }

  buildActionMeta(actionName: string, policies: ActionPoliciesMap): ActionMeta {
    const staticMeta = ACTION_STATIC_META[actionName];
    const policy = policies[actionName];
    const confidence = staticMeta?.confidence ?? 1.0;
    const autoApplied = policy
      ? policy.autoApply && confidence >= policy.minConfidence
      : false;
    return {
      confidence,
      reversible: staticMeta?.reversible ?? true,
      blastRadius: staticMeta?.blastRadius ?? "single_entity",
      autoApplied,
      policyUsed: actionName,
    };
  }

  getDefaultPolicies(): ActionPoliciesMap {
    return { ...DEFAULT_POLICIES };
  }
}
