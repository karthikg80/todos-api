import { McpOAuthService } from "./services/mcpOAuthService";

function createMockPrisma() {
  const authorizationCodes = new Map<string, any>();
  const refreshTokens = new Map<string, any>();

  return {
    mcpAuthorizationCode: {
      create: jest.fn(async ({ data }) => {
        authorizationCodes.set(data.code, { ...data, usedAt: null });
        return data;
      }),
      findUnique: jest.fn(async ({ where }) => {
        return authorizationCodes.get(where.code) || null;
      }),
      update: jest.fn(async ({ where, data }) => {
        const record = authorizationCodes.get(where.code);
        const updated = { ...record, ...data };
        authorizationCodes.set(where.code, updated);
        return updated;
      }),
    },
    mcpRefreshToken: {
      create: jest.fn(async ({ data }) => {
        refreshTokens.set(data.tokenHash, {
          ...data,
          revokedAt: null,
          rotatedAt: null,
        });
        return data;
      }),
      findUnique: jest.fn(async ({ where }) => {
        return refreshTokens.get(where.tokenHash) || null;
      }),
      update: jest.fn(async ({ where, data }) => {
        const record = refreshTokens.get(where.tokenHash);
        const updated = { ...record, ...data };
        refreshTokens.set(where.tokenHash, updated);
        return updated;
      }),
    },
  };
}

describe("McpOAuthService durability", () => {
  it("exchanges authorization codes across service instances when backed by Prisma", async () => {
    const prisma = createMockPrisma();
    const first = new McpOAuthService(prisma as any);
    const second = new McpOAuthService(prisma as any);

    const created = await first.createAuthorizationCode({
      userId: "user-1",
      email: "user-1@example.com",
      clientId: "chatgpt-client",
      redirectUri: "https://chat.openai.com/aip/callback",
      scopes: ["tasks.read"],
      assistantName: "ChatGPT",
      codeChallenge: "abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabc",
      codeChallengeMethod: "S256",
    });

    await expect(
      second.exchangeAuthorizationCode({
        code: created.code,
        clientId: "chatgpt-client",
        redirectUri: "https://chat.openai.com/aip/callback",
        codeVerifier: "pkce-verifier-1111111111111111111111111111111111111",
      }),
    ).rejects.toThrow("Invalid code verifier");
  });

  it("rotates refresh tokens across service instances when backed by Prisma", async () => {
    const prisma = createMockPrisma();
    const first = new McpOAuthService(prisma as any);
    const second = new McpOAuthService(prisma as any);

    const issued = await first.createRefreshToken({
      userId: "user-1",
      email: "user-1@example.com",
      scopes: ["tasks.read"],
      assistantName: "ChatGPT",
      clientId: "chatgpt-client",
    });

    const refreshed = await second.exchangeRefreshToken({
      refreshToken: issued.refreshToken,
      clientId: "chatgpt-client",
    });

    expect(refreshed.refreshToken).toEqual(expect.any(String));
    expect(refreshed.refreshToken).not.toBe(issued.refreshToken);
  });
});
