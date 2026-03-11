import { createHash, randomUUID } from "crypto";
import { McpScope } from "../types";

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

interface AuthorizationCodeRecord extends CreateMcpAuthorizationCodeInput {
  code: string;
  expiresAt: number;
  used: boolean;
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
  private readonly authCodes = new Map<string, AuthorizationCodeRecord>();
  private readonly AUTH_CODE_TTL_MS = 10 * 60 * 1000;

  private pruneExpiredCodes() {
    const now = Date.now();
    for (const [code, record] of this.authCodes.entries()) {
      if (record.expiresAt <= now) {
        this.authCodes.delete(code);
      }
    }
  }

  createAuthorizationCode(input: CreateMcpAuthorizationCodeInput) {
    this.pruneExpiredCodes();

    const code = randomUUID();
    const record: AuthorizationCodeRecord = {
      ...input,
      code,
      expiresAt: Date.now() + this.AUTH_CODE_TTL_MS,
      used: false,
    };
    this.authCodes.set(code, record);

    return {
      code,
      expiresAt: new Date(record.expiresAt).toISOString(),
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      scopes: [...input.scopes],
      ...(input.assistantName ? { assistantName: input.assistantName } : {}),
      ...(input.state ? { state: input.state } : {}),
    };
  }

  exchangeAuthorizationCode(input: ExchangeMcpAuthorizationCodeInput) {
    this.pruneExpiredCodes();

    const record = this.authCodes.get(input.code);
    if (!record) {
      throw new Error("Invalid authorization code");
    }
    if (record.used) {
      this.authCodes.delete(input.code);
      throw new Error("Authorization code already used");
    }
    if (record.expiresAt <= Date.now()) {
      this.authCodes.delete(input.code);
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

    record.used = true;
    this.authCodes.delete(input.code);

    return {
      userId: record.userId,
      email: record.email,
      scopes: [...record.scopes],
      clientId: record.clientId,
      ...(record.assistantName ? { assistantName: record.assistantName } : {}),
    };
  }
}
