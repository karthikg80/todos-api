import { createHash, createHmac, randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { McpScope } from "../types";
import { config } from "../config";
import { normalizeMcpScopes } from "../mcp/mcpScopes";

export interface CreateMcpAuthorizationCodeInput {
  userId: string;
  email: string;
  clientId: string;
  redirectUri: string;
  scopes: McpScope[];
  assistantName?: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface ExchangeMcpAuthorizationCodeInput {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}

export interface CreateMcpAssistantSessionInput {
  userId: string;
  scopes: McpScope[];
  assistantName?: string;
  clientId?: string;
  source: "oauth" | "local";
}

export interface McpAssistantSessionSummary {
  id: string;
  userId: string;
  scopes: McpScope[];
  source: "oauth" | "local";
  clientId?: string;
  assistantName?: string;
  revokedAt?: string;
  lastAccessTokenIssuedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpRefreshTokenInput {
  userId: string;
  email: string;
  scopes: McpScope[];
  assistantName?: string;
  clientId?: string;
  sessionId?: string;
}

export interface ExchangeMcpRefreshTokenInput {
  refreshToken: string;
  clientId?: string;
}

interface AuthorizationCodeRecord extends CreateMcpAuthorizationCodeInput {
  code: string;
  expiresAt: number;
  used: boolean;
}

interface AssistantSessionRecord extends CreateMcpAssistantSessionInput {
  id: string;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number;
  lastAccessTokenIssuedAt?: number;
  lastUsedAt?: number;
}

interface RefreshTokenRecord extends CreateMcpRefreshTokenInput {
  refreshToken: string;
  expiresAt: number;
  revoked: boolean;
  rotated: boolean;
}

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sha256Base64Url(value: string): string {
  return toBase64Url(createHash("sha256").update(value, "utf8").digest());
}

function toIso(value?: number | null): string | undefined {
  return typeof value === "number" ? new Date(value).toISOString() : undefined;
}

export class McpOAuthService {
  constructor(private readonly prisma?: PrismaClient) {}

  private readonly authCodes = new Map<string, AuthorizationCodeRecord>();
  private readonly assistantSessions = new Map<
    string,
    AssistantSessionRecord
  >();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly AUTH_CODE_TTL_MS = 10 * 60 * 1000;
  private readonly REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  private pruneExpiredCodes() {
    const now = Date.now();
    for (const [code, record] of this.authCodes.entries()) {
      if (record.expiresAt <= now) {
        this.authCodes.delete(code);
      }
    }
  }

  private pruneExpiredRefreshTokens() {
    const now = Date.now();
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.expiresAt <= now || record.revoked || record.rotated) {
        this.refreshTokens.delete(token);
      }
    }
  }

  private hashRefreshToken(token: string): string {
    return createHmac("sha256", config.refreshJwtSecret)
      .update(token)
      .digest("hex");
  }

  private serializeSessionFromMemory(
    session: AssistantSessionRecord,
  ): McpAssistantSessionSummary {
    return {
      id: session.id,
      userId: session.userId,
      scopes: [...session.scopes],
      source: session.source,
      ...(session.clientId ? { clientId: session.clientId } : {}),
      ...(session.assistantName
        ? { assistantName: session.assistantName }
        : {}),
      ...(session.revokedAt ? { revokedAt: toIso(session.revokedAt) } : {}),
      ...(session.lastAccessTokenIssuedAt
        ? { lastAccessTokenIssuedAt: toIso(session.lastAccessTokenIssuedAt) }
        : {}),
      ...(session.lastUsedAt ? { lastUsedAt: toIso(session.lastUsedAt) } : {}),
      createdAt: new Date(session.createdAt).toISOString(),
      updatedAt: new Date(session.updatedAt).toISOString(),
    };
  }

  async createAuthorizationCode(input: CreateMcpAuthorizationCodeInput) {
    this.pruneExpiredCodes();

    const code = randomUUID();
    const expiresAt = Date.now() + this.AUTH_CODE_TTL_MS;

    if (this.prisma) {
      await this.prisma.mcpAuthorizationCode.create({
        data: {
          code,
          userId: input.userId,
          email: input.email,
          clientId: input.clientId,
          redirectUri: input.redirectUri,
          scopes: [...input.scopes],
          assistantName: input.assistantName,
          state: input.state,
          codeChallenge: input.codeChallenge,
          codeChallengeMethod: input.codeChallengeMethod,
          expiresAt: new Date(expiresAt),
        },
      });
    } else {
      const record: AuthorizationCodeRecord = {
        ...input,
        code,
        expiresAt,
        used: false,
      };
      this.authCodes.set(code, record);
    }

    return {
      code,
      expiresAt: new Date(expiresAt).toISOString(),
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      scopes: [...input.scopes],
      ...(input.assistantName ? { assistantName: input.assistantName } : {}),
      ...(input.state ? { state: input.state } : {}),
    };
  }

  async exchangeAuthorizationCode(input: ExchangeMcpAuthorizationCodeInput) {
    this.pruneExpiredCodes();

    let record:
      | {
          userId: string;
          email: string;
          scopes: McpScope[];
          clientId: string;
          redirectUri: string;
          assistantName?: string;
          codeChallenge: string;
          codeChallengeMethod: "S256";
          expiresAt: number;
          used: boolean;
        }
      | undefined;

    if (this.prisma) {
      const persisted = await this.prisma.mcpAuthorizationCode.findUnique({
        where: { code: input.code },
      });
      if (!persisted) {
        throw new Error("Invalid authorization code");
      }
      record = {
        userId: persisted.userId,
        email: persisted.email,
        scopes: normalizeMcpScopes(persisted.scopes),
        clientId: persisted.clientId,
        redirectUri: persisted.redirectUri,
        ...(persisted.assistantName
          ? { assistantName: persisted.assistantName }
          : {}),
        codeChallenge: persisted.codeChallenge,
        codeChallengeMethod: persisted.codeChallengeMethod as "S256",
        expiresAt: persisted.expiresAt.getTime(),
        used: Boolean(persisted.usedAt),
      };
    } else {
      const memoryRecord = this.authCodes.get(input.code);
      if (memoryRecord) {
        record = {
          userId: memoryRecord.userId,
          email: memoryRecord.email,
          scopes: [...memoryRecord.scopes],
          clientId: memoryRecord.clientId,
          redirectUri: memoryRecord.redirectUri,
          ...(memoryRecord.assistantName
            ? { assistantName: memoryRecord.assistantName }
            : {}),
          codeChallenge: memoryRecord.codeChallenge,
          codeChallengeMethod: memoryRecord.codeChallengeMethod,
          expiresAt: memoryRecord.expiresAt,
          used: memoryRecord.used,
        };
      }
    }

    if (!record) {
      throw new Error("Invalid authorization code");
    }
    if (record.used) {
      if (!this.prisma) {
        this.authCodes.delete(input.code);
      }
      throw new Error("Authorization code already used");
    }
    if (record.expiresAt <= Date.now()) {
      if (!this.prisma) {
        this.authCodes.delete(input.code);
      }
      throw new Error("Authorization code expired");
    }
    if (
      record.clientId !== input.clientId ||
      record.redirectUri !== input.redirectUri
    ) {
      throw new Error("Authorization code binding mismatch");
    }
    if (record.codeChallengeMethod !== "S256") {
      throw new Error("Unsupported code challenge method");
    }

    const derivedChallenge = sha256Base64Url(input.codeVerifier);
    if (derivedChallenge !== record.codeChallenge) {
      throw new Error("Invalid code verifier");
    }

    if (this.prisma) {
      await this.prisma.mcpAuthorizationCode.update({
        where: { code: input.code },
        data: {
          usedAt: new Date(),
        },
      });
    } else {
      const memoryRecord = this.authCodes.get(input.code);
      if (memoryRecord) {
        memoryRecord.used = true;
        this.authCodes.delete(input.code);
      }
    }

    return {
      userId: record.userId,
      email: record.email,
      scopes: [...record.scopes],
      clientId: record.clientId,
      ...(record.assistantName ? { assistantName: record.assistantName } : {}),
    };
  }

  async createAssistantSession(input: CreateMcpAssistantSessionInput) {
    if (this.prisma) {
      const session = await this.prisma.mcpAssistantSession.create({
        data: {
          userId: input.userId,
          clientId: input.clientId,
          assistantName: input.assistantName,
          scopes: [...input.scopes],
          source: input.source,
        },
      });

      return {
        id: session.id,
        userId: session.userId,
        scopes: normalizeMcpScopes(session.scopes),
        source: session.source as "oauth" | "local",
        ...(session.clientId ? { clientId: session.clientId } : {}),
        ...(session.assistantName
          ? { assistantName: session.assistantName }
          : {}),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    }

    const now = Date.now();
    const session: AssistantSessionRecord = {
      id: randomUUID(),
      userId: input.userId,
      scopes: [...input.scopes],
      source: input.source,
      ...(input.clientId ? { clientId: input.clientId } : {}),
      ...(input.assistantName ? { assistantName: input.assistantName } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.assistantSessions.set(session.id, session);
    return this.serializeSessionFromMemory(session);
  }

  async listAssistantSessions(userId: string) {
    if (this.prisma) {
      const sessions = await this.prisma.mcpAssistantSession.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return sessions.map((session) => ({
        id: session.id,
        userId: session.userId,
        scopes: normalizeMcpScopes(session.scopes),
        source: session.source as "oauth" | "local",
        ...(session.clientId ? { clientId: session.clientId } : {}),
        ...(session.assistantName
          ? { assistantName: session.assistantName }
          : {}),
        ...(session.revokedAt
          ? { revokedAt: session.revokedAt.toISOString() }
          : {}),
        ...(session.lastAccessTokenIssuedAt
          ? {
              lastAccessTokenIssuedAt:
                session.lastAccessTokenIssuedAt.toISOString(),
            }
          : {}),
        ...(session.lastUsedAt
          ? { lastUsedAt: session.lastUsedAt.toISOString() }
          : {}),
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      }));
    }

    return Array.from(this.assistantSessions.values())
      .filter((session) => session.userId === userId && !session.revokedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => this.serializeSessionFromMemory(session));
  }

  async recordAccessTokenIssued(sessionId: string): Promise<void> {
    const now = new Date();
    if (this.prisma) {
      await this.prisma.mcpAssistantSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: {
          lastAccessTokenIssuedAt: now,
        },
      });
      return;
    }

    const session = this.assistantSessions.get(sessionId);
    if (!session || session.revokedAt) {
      return;
    }
    session.lastAccessTokenIssuedAt = now.getTime();
    session.updatedAt = now.getTime();
  }

  async recordAssistantSessionUsage(sessionId: string): Promise<void> {
    const now = new Date();
    if (this.prisma) {
      await this.prisma.mcpAssistantSession.updateMany({
        where: {
          id: sessionId,
          revokedAt: null,
        },
        data: {
          lastUsedAt: now,
        },
      });
      return;
    }

    const session = this.assistantSessions.get(sessionId);
    if (!session || session.revokedAt) {
      return;
    }
    session.lastUsedAt = now.getTime();
    session.updatedAt = now.getTime();
  }

  async revokeAssistantSession(input: {
    userId: string;
    sessionId: string;
  }): Promise<boolean> {
    const revokedAt = new Date();
    if (this.prisma) {
      const result = await this.prisma.mcpAssistantSession.updateMany({
        where: {
          id: input.sessionId,
          userId: input.userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
      if (result.count > 0) {
        await this.prisma.mcpRefreshToken.updateMany({
          where: {
            sessionId: input.sessionId,
            revokedAt: null,
          },
          data: {
            revokedAt,
          },
        });
      }
      return result.count > 0;
    }

    const session = this.assistantSessions.get(input.sessionId);
    if (!session || session.userId !== input.userId || session.revokedAt) {
      return false;
    }
    session.revokedAt = revokedAt.getTime();
    session.updatedAt = revokedAt.getTime();
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.sessionId === input.sessionId) {
        record.revoked = true;
        this.refreshTokens.delete(token);
      }
    }
    return true;
  }

  async revokeAllAssistantSessions(userId: string): Promise<number> {
    const revokedAt = new Date();
    if (this.prisma) {
      const result = await this.prisma.mcpAssistantSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
      await this.prisma.mcpRefreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
      return result.count;
    }

    let count = 0;
    for (const session of this.assistantSessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = revokedAt.getTime();
        session.updatedAt = revokedAt.getTime();
        count += 1;
      }
    }
    for (const [token, record] of this.refreshTokens.entries()) {
      if (record.userId === userId) {
        record.revoked = true;
        this.refreshTokens.delete(token);
      }
    }
    return count;
  }

  private async ensureSessionForRefreshTokenRecord(input: {
    userId: string;
    scopes: McpScope[];
    assistantName?: string;
    clientId?: string;
    sessionId?: string | null;
    tokenHash: string;
  }) {
    if (input.sessionId) {
      return input.sessionId;
    }

    const session = await this.createAssistantSession({
      userId: input.userId,
      scopes: input.scopes,
      assistantName: input.assistantName,
      clientId: input.clientId,
      source: "oauth",
    });

    if (this.prisma) {
      await this.prisma.mcpRefreshToken.update({
        where: {
          tokenHash: input.tokenHash,
        },
        data: {
          sessionId: session.id,
        },
      });
    } else {
      const memoryRecord = this.refreshTokens.get(input.tokenHash);
      if (memoryRecord) {
        memoryRecord.sessionId = session.id;
      }
    }

    return session.id;
  }

  async createRefreshToken(input: CreateMcpRefreshTokenInput) {
    this.pruneExpiredRefreshTokens();

    const refreshToken = `${randomUUID()}.${randomUUID()}`;
    const expiresAt = Date.now() + this.REFRESH_TOKEN_TTL_MS;

    if (this.prisma) {
      await this.prisma.mcpRefreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: input.userId,
          sessionId: input.sessionId,
          email: input.email,
          scopes: [...input.scopes],
          assistantName: input.assistantName,
          clientId: input.clientId,
          expiresAt: new Date(expiresAt),
        },
      });
    } else {
      this.refreshTokens.set(refreshToken, {
        ...input,
        refreshToken,
        expiresAt,
        revoked: false,
        rotated: false,
      });
    }

    return {
      refreshToken,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresIn: Math.floor(this.REFRESH_TOKEN_TTL_MS / 1000),
    };
  }

  async exchangeRefreshToken(input: ExchangeMcpRefreshTokenInput) {
    this.pruneExpiredRefreshTokens();

    let record:
      | {
          userId: string;
          email: string;
          scopes: McpScope[];
          assistantName?: string;
          clientId?: string;
          sessionId?: string;
          expiresAt: number;
          revoked: boolean;
          rotated: boolean;
          sessionRevoked: boolean;
          tokenHash: string;
        }
      | undefined;

    if (this.prisma) {
      const tokenHash = this.hashRefreshToken(input.refreshToken);
      const persisted = await this.prisma.mcpRefreshToken.findUnique({
        where: {
          tokenHash,
        },
        include: {
          session: true,
        },
      });
      if (persisted) {
        record = {
          userId: persisted.userId,
          email: persisted.email,
          scopes: normalizeMcpScopes(persisted.scopes),
          ...(persisted.assistantName
            ? { assistantName: persisted.assistantName }
            : {}),
          ...(persisted.clientId ? { clientId: persisted.clientId } : {}),
          ...(persisted.sessionId ? { sessionId: persisted.sessionId } : {}),
          expiresAt: persisted.expiresAt.getTime(),
          revoked: Boolean(persisted.revokedAt),
          rotated: Boolean(persisted.rotatedAt),
          sessionRevoked: Boolean(persisted.session?.revokedAt),
          tokenHash,
        };
      }
    } else {
      const memoryRecord = this.refreshTokens.get(input.refreshToken);
      if (memoryRecord) {
        const session = memoryRecord.sessionId
          ? this.assistantSessions.get(memoryRecord.sessionId)
          : undefined;
        record = {
          userId: memoryRecord.userId,
          email: memoryRecord.email,
          scopes: [...memoryRecord.scopes],
          ...(memoryRecord.assistantName
            ? { assistantName: memoryRecord.assistantName }
            : {}),
          ...(memoryRecord.clientId ? { clientId: memoryRecord.clientId } : {}),
          ...(memoryRecord.sessionId
            ? { sessionId: memoryRecord.sessionId }
            : {}),
          expiresAt: memoryRecord.expiresAt,
          revoked: memoryRecord.revoked,
          rotated: memoryRecord.rotated,
          sessionRevoked: Boolean(session?.revokedAt),
          tokenHash: input.refreshToken,
        };
      }
    }

    if (!record) {
      throw new Error("Invalid refresh token");
    }
    if (record.sessionRevoked) {
      throw new Error("Assistant session revoked");
    }
    if (record.revoked && !record.rotated) {
      throw new Error("Assistant session revoked");
    }
    if (record.rotated) {
      throw new Error("Refresh token already rotated");
    }
    if (record.expiresAt <= Date.now()) {
      throw new Error("Refresh token expired");
    }
    if (
      record.clientId &&
      input.clientId &&
      record.clientId !== input.clientId
    ) {
      throw new Error("Refresh token client mismatch");
    }

    const sessionId = await this.ensureSessionForRefreshTokenRecord({
      userId: record.userId,
      scopes: record.scopes,
      assistantName: record.assistantName,
      clientId: record.clientId,
      sessionId: record.sessionId,
      tokenHash: record.tokenHash,
    });

    const nextRefreshToken = await this.createRefreshToken({
      userId: record.userId,
      email: record.email,
      scopes: record.scopes,
      assistantName: record.assistantName,
      clientId: record.clientId,
      sessionId,
    });

    if (this.prisma) {
      await this.prisma.mcpRefreshToken.update({
        where: {
          tokenHash: record.tokenHash,
        },
        data: {
          revokedAt: new Date(),
          rotatedAt: new Date(),
        },
      });
    } else {
      const memoryRecord = this.refreshTokens.get(input.refreshToken);
      if (memoryRecord) {
        memoryRecord.revoked = true;
        memoryRecord.rotated = true;
        this.refreshTokens.delete(input.refreshToken);
      }
    }

    return {
      userId: record.userId,
      email: record.email,
      scopes: record.scopes,
      sessionId,
      ...(record.assistantName ? { assistantName: record.assistantName } : {}),
      ...(record.clientId ? { clientId: record.clientId } : {}),
      refreshToken: nextRefreshToken.refreshToken,
      refreshTokenExpiresAt: nextRefreshToken.expiresAt,
      refreshTokenExpiresIn: nextRefreshToken.expiresIn,
    };
  }

  async revokeRefreshToken(input: {
    refreshToken: string;
    clientId?: string;
  }): Promise<{ revoked: boolean; sessionId?: string; userId?: string }> {
    const tokenHash = this.hashRefreshToken(input.refreshToken);

    if (this.prisma) {
      const persisted = await this.prisma.mcpRefreshToken.findUnique({
        where: { tokenHash },
      });
      if (!persisted) {
        return { revoked: false };
      }
      if (
        persisted.clientId &&
        input.clientId &&
        persisted.clientId !== input.clientId
      ) {
        throw new Error("Refresh token client mismatch");
      }
      await this.prisma.mcpRefreshToken.update({
        where: { tokenHash },
        data: {
          revokedAt: new Date(),
        },
      });
      if (persisted.sessionId) {
        await this.prisma.mcpAssistantSession.updateMany({
          where: {
            id: persisted.sessionId,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
          },
        });
      }
      return {
        revoked: true,
        ...(persisted.sessionId ? { sessionId: persisted.sessionId } : {}),
        userId: persisted.userId,
      };
    }

    const memoryRecord = this.refreshTokens.get(input.refreshToken);
    if (!memoryRecord) {
      return { revoked: false };
    }
    if (
      memoryRecord.clientId &&
      input.clientId &&
      memoryRecord.clientId !== input.clientId
    ) {
      throw new Error("Refresh token client mismatch");
    }
    memoryRecord.revoked = true;
    this.refreshTokens.delete(input.refreshToken);
    if (memoryRecord.sessionId) {
      const session = this.assistantSessions.get(memoryRecord.sessionId);
      if (session && !session.revokedAt) {
        session.revokedAt = Date.now();
        session.updatedAt = Date.now();
      }
    }
    return {
      revoked: true,
      ...(memoryRecord.sessionId ? { sessionId: memoryRecord.sessionId } : {}),
      userId: memoryRecord.userId,
    };
  }
}
