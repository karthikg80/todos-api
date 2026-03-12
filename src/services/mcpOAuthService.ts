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

export interface CreateMcpRefreshTokenInput {
  userId: string;
  email: string;
  scopes: McpScope[];
  assistantName?: string;
  clientId?: string;
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

export class McpOAuthService {
  constructor(private readonly prisma?: PrismaClient) {}

  private readonly authCodes = new Map<string, AuthorizationCodeRecord>();
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

  async createRefreshToken(input: CreateMcpRefreshTokenInput) {
    this.pruneExpiredRefreshTokens();

    const refreshToken = `${randomUUID()}.${randomUUID()}`;
    const expiresAt = Date.now() + this.REFRESH_TOKEN_TTL_MS;

    if (this.prisma) {
      await this.prisma.mcpRefreshToken.create({
        data: {
          tokenHash: this.hashRefreshToken(refreshToken),
          userId: input.userId,
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
          expiresAt: number;
          revoked: boolean;
          rotated: boolean;
        }
      | undefined;

    if (this.prisma) {
      const persisted = await this.prisma.mcpRefreshToken.findUnique({
        where: {
          tokenHash: this.hashRefreshToken(input.refreshToken),
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
          expiresAt: persisted.expiresAt.getTime(),
          revoked: Boolean(persisted.revokedAt),
          rotated: Boolean(persisted.rotatedAt),
        };
      }
    } else {
      const memoryRecord = this.refreshTokens.get(input.refreshToken);
      if (memoryRecord) {
        record = {
          userId: memoryRecord.userId,
          email: memoryRecord.email,
          scopes: [...memoryRecord.scopes],
          ...(memoryRecord.assistantName
            ? { assistantName: memoryRecord.assistantName }
            : {}),
          ...(memoryRecord.clientId ? { clientId: memoryRecord.clientId } : {}),
          expiresAt: memoryRecord.expiresAt,
          revoked: memoryRecord.revoked,
          rotated: memoryRecord.rotated,
        };
      }
    }

    if (!record) {
      throw new Error("Invalid refresh token");
    }
    if (record.revoked || record.rotated) {
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

    const nextRefreshToken = await this.createRefreshToken({
      userId: record.userId,
      email: record.email,
      scopes: record.scopes,
      assistantName: record.assistantName,
      clientId: record.clientId,
    });

    if (this.prisma) {
      await this.prisma.mcpRefreshToken.update({
        where: {
          tokenHash: this.hashRefreshToken(input.refreshToken),
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
      ...(record.assistantName ? { assistantName: record.assistantName } : {}),
      ...(record.clientId ? { clientId: record.clientId } : {}),
      refreshToken: nextRefreshToken.refreshToken,
      refreshTokenExpiresAt: nextRefreshToken.expiresAt,
      refreshTokenExpiresIn: nextRefreshToken.expiresIn,
    };
  }
}
