import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface EnrollmentStatus {
  enrolled: boolean;
  active: boolean;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  timezone: string;
  enrolledAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
}

export interface ExchangeResult {
  accessToken: string;
  expiresIn: number; // seconds
}

function generateRefreshToken(): string {
  return randomBytes(32).toString("hex"); // 64-char hex, 256 bits of entropy
}

export class AgentEnrollmentService {
  private readonly ACCESS_JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = "15m";
  private readonly JWT_EXPIRES_IN_MS = 15 * 60 * 1000;

  constructor(private readonly prisma: PrismaClient) {
    this.ACCESS_JWT_SECRET =
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      config.accessJwtSecret;
  }

  // ── User-facing ────────────────────────────────────────────────────────────

  async enroll(
    userId: string,
    opts: {
      timezone?: string;
      dailyEnabled?: boolean;
      weeklyEnabled?: boolean;
    } = {},
  ): Promise<EnrollmentStatus> {
    const token = generateRefreshToken();

    await this.prisma.agentEnrollment.upsert({
      where: { userId },
      create: {
        userId,
        refreshToken: token,
        timezone: opts.timezone ?? "America/New_York",
        dailyEnabled: opts.dailyEnabled ?? true,
        weeklyEnabled: opts.weeklyEnabled ?? true,
        active: true,
      },
      update: {
        // Re-enrolling reactivates and rotates the token.
        refreshToken: token,
        active: true,
        ...(opts.timezone !== undefined ? { timezone: opts.timezone } : {}),
        ...(opts.dailyEnabled !== undefined
          ? { dailyEnabled: opts.dailyEnabled }
          : {}),
        ...(opts.weeklyEnabled !== undefined
          ? { weeklyEnabled: opts.weeklyEnabled }
          : {}),
      },
    });

    return this.getStatus(userId);
  }

  async update(
    userId: string,
    patch: {
      timezone?: string;
      dailyEnabled?: boolean;
      weeklyEnabled?: boolean;
    },
  ): Promise<EnrollmentStatus> {
    const existing = await this.prisma.agentEnrollment.findUnique({
      where: { userId },
    });
    if (!existing || !existing.active) {
      throw Object.assign(new Error("Not enrolled"), { code: "NOT_ENROLLED" });
    }

    await this.prisma.agentEnrollment.update({
      where: { userId },
      data: {
        ...(patch.timezone !== undefined ? { timezone: patch.timezone } : {}),
        ...(patch.dailyEnabled !== undefined
          ? { dailyEnabled: patch.dailyEnabled }
          : {}),
        ...(patch.weeklyEnabled !== undefined
          ? { weeklyEnabled: patch.weeklyEnabled }
          : {}),
      },
    });

    return this.getStatus(userId);
  }

  async revoke(userId: string): Promise<void> {
    await this.prisma.agentEnrollment.updateMany({
      where: { userId },
      data: { active: false },
    });
  }

  async getStatus(userId: string): Promise<EnrollmentStatus> {
    const row = await this.prisma.agentEnrollment.findUnique({
      where: { userId },
    });

    if (!row) {
      return {
        enrolled: false,
        active: false,
        dailyEnabled: false,
        weeklyEnabled: false,
        timezone: "America/New_York",
        enrolledAt: null,
        lastRunAt: null,
        lastRunStatus: null,
      };
    }

    return {
      enrolled: true,
      active: row.active,
      dailyEnabled: row.dailyEnabled,
      weeklyEnabled: row.weeklyEnabled,
      timezone: row.timezone,
      enrolledAt: row.enrolledAt.toISOString(),
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      lastRunStatus: row.lastRunStatus,
    };
  }

  // ── Runner-facing ──────────────────────────────────────────────────────────

  /**
   * Exchange a valid enrollment refresh token for a short-lived access JWT.
   * The refresh token is rotated on every successful exchange so a leaked
   * token is valid for at most one run.
   */
  async exchangeToken(refreshToken: string): Promise<ExchangeResult> {
    const enrollment = await this.prisma.agentEnrollment.findFirst({
      where: { refreshToken, active: true },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!enrollment) {
      throw Object.assign(new Error("Invalid or revoked enrollment token"), {
        code: "INVALID_ENROLLMENT_TOKEN",
      });
    }

    const newToken = generateRefreshToken();

    await this.prisma.agentEnrollment.update({
      where: { id: enrollment.id },
      data: { refreshToken: newToken, lastRunAt: new Date() },
    });

    const accessToken = jwt.sign(
      { userId: enrollment.user.id, email: enrollment.user.email },
      this.ACCESS_JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN },
    );

    return { accessToken, expiresIn: this.JWT_EXPIRES_IN_MS / 1000 };
  }

  /**
   * Update run outcome. Called by the runner after each user's job finishes.
   * Uses a raw updateMany so a missing enrollment row is silently ignored.
   */
  async recordRunOutcome(
    userId: string,
    status: "success" | "partial" | "error",
    error?: string,
  ): Promise<void> {
    await this.prisma.agentEnrollment.updateMany({
      where: { userId },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: status,
        lastRunError: error ?? null,
      },
    });
  }

  /**
   * Return all active enrollments. Used by the runner to fan out per-user jobs.
   * Only exposes fields the runner needs; the refreshToken is intentionally
   * excluded here — the runner fetches it via the exchange endpoint.
   */
  async getActiveEnrollments(): Promise<
    Array<{
      userId: string;
      timezone: string;
      dailyEnabled: boolean;
      weeklyEnabled: boolean;
    }>
  > {
    const rows = await this.prisma.agentEnrollment.findMany({
      where: { active: true },
      select: {
        userId: true,
        timezone: true,
        dailyEnabled: true,
        weeklyEnabled: true,
      },
    });
    return rows;
  }
}
