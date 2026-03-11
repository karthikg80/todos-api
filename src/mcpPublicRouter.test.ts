import { createHash } from "crypto";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "./app";
import { TodoService } from "./services/todoService";
import type { IProjectService } from "./interfaces/IProjectService";
import type {
  CreateProjectDto,
  McpScope,
  Project,
  ProjectTaskDisposition,
  UpdateProjectDto,
} from "./types";

function createProjectServiceMock(): jest.Mocked<IProjectService> {
  return {
    findAll: jest.fn<Promise<Project[]>, [string]>(),
    findById: jest.fn<Promise<Project | null>, [string, string]>(),
    create: jest.fn<Promise<Project>, [string, CreateProjectDto]>(),
    update: jest.fn<
      Promise<Project | null>,
      [string, string, UpdateProjectDto]
    >(),
    setArchived: jest.fn<Promise<Project | null>, [string, string, boolean]>(),
    delete: jest.fn<
      Promise<boolean>,
      [string, string, ProjectTaskDisposition, (string | null)?]
    >(),
  };
}

function buildMcpSession(userId: string, scopes: McpScope[]) {
  return {
    userId,
    email: `${userId}@example.com`,
    tokenType: "mcp" as const,
    scopes,
    assistantName: "ChatGPT",
    clientId: "chatgpt-client",
  };
}

function createPkcePair(verifier: string) {
  const challenge = createHash("sha256")
    .update(verifier, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return { verifier, challenge };
}

describe("Public MCP OAuth and discovery routes", () => {
  let app: Express;
  let currentSession: ReturnType<typeof buildMcpSession>;
  let mockAuthService: {
    login: jest.Mock;
    verifyToken: jest.Mock;
    createMcpToken: jest.Mock;
    verifyMcpToken: jest.Mock;
    getUserById: jest.Mock;
  };

  beforeEach(() => {
    currentSession = buildMcpSession("user-1", ["tasks.read"]);
    mockAuthService = {
      login: jest.fn().mockResolvedValue({
        user: {
          id: "user-1",
          email: "user-1@example.com",
          name: "User One",
        },
        token: "app-session-token",
      }),
      verifyToken: jest.fn().mockReturnValue({
        userId: "user-1",
        email: "user-1@example.com",
      }),
      createMcpToken: jest.fn().mockImplementation((input) => ({
        token: `mcp-token-${input.userId}`,
        tokenType: "Bearer",
        scope: [...input.scopes].sort().join(" "),
        scopes: [...input.scopes].sort(),
        expiresAt: "2026-04-10T00:00:00.000Z",
        expiresIn: 2592000,
        assistantName: input.assistantName,
        clientId: input.clientId,
      })),
      verifyMcpToken: jest.fn().mockImplementation(() => currentSession),
      getUserById: jest.fn().mockImplementation(async (userId: string) => {
        if (userId === "missing-user") {
          return null;
        }

        return {
          id: userId,
          email: `${userId}@example.com`,
          name: userId,
          isVerified: true,
          role: "user",
          plan: "free",
          createdAt: new Date("2026-03-11T00:00:00.000Z"),
          updatedAt: new Date("2026-03-11T00:00:00.000Z"),
        };
      }),
    };

    app = createApp(
      new TodoService(),
      mockAuthService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      createProjectServiceMock(),
    );
  });

  it("publishes OAuth authorization server metadata for remote connectors", async () => {
    const response = await request(app)
      .get("/.well-known/oauth-authorization-server")
      .expect(200);

    expect(response.body.authorization_endpoint).toMatch(/\/oauth\/authorize$/);
    expect(response.body.token_endpoint).toMatch(/\/oauth\/token$/);
    expect(response.body.registration_endpoint).toMatch(/\/oauth\/register$/);
    expect(response.body.code_challenge_methods_supported).toContain("S256");
  });

  it("registers a public PKCE client for connector use", async () => {
    const response = await request(app)
      .post("/oauth/register")
      .send({
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        client_name: "ChatGPT",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      })
      .expect(201);

    expect(response.body.client_id).toEqual(expect.any(String));
    expect(response.body.redirect_uris).toEqual([
      "https://chat.openai.com/aip/callback",
    ]);
    expect(response.body.grant_types).toEqual(["authorization_code"]);
    expect(response.body.token_endpoint_auth_method).toBe("none");
  });

  it("accepts public clients that request refresh-token grant metadata", async () => {
    const response = await request(app)
      .post("/oauth/register")
      .send({
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        client_name: "Codex",
        grant_types: ["refresh_token", "authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      })
      .expect(201);

    expect(response.body.client_id).toEqual(expect.any(String));
    expect(response.body.grant_types).toEqual([
      "authorization_code",
      "refresh_token",
    ]);
    expect(response.body.response_types).toEqual(["code"]);
  });

  it("rejects unsupported OAuth client grant types during registration", async () => {
    const response = await request(app)
      .post("/oauth/register")
      .send({
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        grant_types: ["authorization_code", "client_credentials"],
      })
      .expect(400);

    expect(response.body.error).toBe("invalid_client_metadata");
    expect(response.body.error_description).toContain(
      '"authorization_code" and optional "refresh_token"',
    );
    expect(response.body.error_details.code).toBe(
      "MCP_OAUTH_AUTHORIZE_INVALID",
    );
  });

  it("completes the browser-style OAuth code flow for a registered connector", async () => {
    const register = await request(app)
      .post("/oauth/register")
      .send({
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        client_name: "ChatGPT",
      })
      .expect(201);

    const pkce = createPkcePair(
      "oauth-verifier-public-flow-1111111111111111111111111111111",
    );
    const scope = "tasks.read tasks.write";
    const agent = request.agent(app);

    const authorizeUrl = `/oauth/authorize?client_id=${encodeURIComponent(
      register.body.client_id,
    )}&redirect_uri=${encodeURIComponent(
      "https://chat.openai.com/aip/callback",
    )}&response_type=code&scope=${encodeURIComponent(
      scope,
    )}&state=state-123&code_challenge=${encodeURIComponent(
      pkce.challenge,
    )}&code_challenge_method=S256`;

    const loginPage = await agent.get(authorizeUrl).expect(200);
    expect(loginPage.text).toContain("Connect Assistant");

    const login = await agent
      .post("/oauth/authorize/login")
      .type("form")
      .send({
        email: "user-1@example.com",
        password: "password123",
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        response_type: "code",
        scope,
        state: "state-123",
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
      })
      .expect(303);

    expect(login.headers.location).toContain("/oauth/authorize?");

    const consent = await agent.get(login.headers.location).expect(200);
    expect(consent.text).toContain("Authorize Assistant");
    expect(consent.text).toContain("tasks.read");
    expect(consent.text).toContain("tasks.write");

    const approve = await agent
      .post("/oauth/authorize/decision")
      .type("form")
      .send({
        decision: "approve",
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        response_type: "code",
        scope,
        state: "state-123",
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
      })
      .expect(303);

    const redirectUrl = new URL(approve.headers.location);
    const code = redirectUrl.searchParams.get("code");
    expect(redirectUrl.origin + redirectUrl.pathname).toBe(
      "https://chat.openai.com/aip/callback",
    );
    expect(redirectUrl.searchParams.get("state")).toBe("state-123");
    expect(code).toEqual(expect.any(String));

    const token = await request(app)
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        code_verifier: pkce.verifier,
      })
      .expect(200);

    expect(token.body.access_token).toBe("mcp-token-user-1");
    expect(token.body.token_type).toBe("Bearer");
    expect(token.body.scope).toBe("tasks.read tasks.write");
  });

  it("defaults authorize scopes when the connector omits scope", async () => {
    const register = await request(app)
      .post("/oauth/register")
      .send({
        redirect_uris: ["https://chat.openai.com/aip/callback"],
        client_name: "Codex",
      })
      .expect(201);

    const pkce = createPkcePair(
      "oauth-verifier-default-scope-1111111111111111111111111111",
    );
    const agent = request.agent(app);

    const authorizeUrl = `/oauth/authorize?client_id=${encodeURIComponent(
      register.body.client_id,
    )}&redirect_uri=${encodeURIComponent(
      "https://chat.openai.com/aip/callback",
    )}&response_type=code&state=state-default-scope&code_challenge=${encodeURIComponent(
      pkce.challenge,
    )}&code_challenge_method=S256`;

    const loginPage = await agent.get(authorizeUrl).expect(200);
    expect(loginPage.text).toContain("Connect Assistant");

    const login = await agent
      .post("/oauth/authorize/login")
      .type("form")
      .send({
        email: "user-1@example.com",
        password: "password123",
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        response_type: "code",
        state: "state-default-scope",
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
      })
      .expect(303);

    expect(login.headers.location).toContain("/oauth/authorize?");
    expect(login.headers.location).toContain("scope=projects.read+tasks.read");

    const consent = await agent.get(login.headers.location).expect(200);
    expect(consent.text).toContain("Authorize Assistant");
    expect(consent.text).toContain("tasks.read");
    expect(consent.text).toContain("projects.read");

    const approve = await agent
      .post("/oauth/authorize/decision")
      .type("form")
      .send({
        decision: "approve",
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        response_type: "code",
        state: "state-default-scope",
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
      })
      .expect(303);

    const redirectUrl = new URL(approve.headers.location);
    const code = redirectUrl.searchParams.get("code");
    expect(code).toEqual(expect.any(String));

    const token = await request(app)
      .post("/oauth/token")
      .type("form")
      .send({
        grant_type: "authorization_code",
        code,
        client_id: register.body.client_id,
        redirect_uri: "https://chat.openai.com/aip/callback",
        code_verifier: pkce.verifier,
      })
      .expect(200);

    expect(token.body.scope).toBe("projects.read tasks.read");
  });

  it("advertises resource metadata when MCP auth is missing", async () => {
    const response = await request(app).get("/mcp").expect(401);

    expect(response.headers["www-authenticate"]).toContain(
      ".well-known/oauth-protected-resource",
    );
    expect(response.body.error.code).toBe("MCP_UNAUTHENTICATED");
  });

  it("opens an authenticated MCP stream endpoint for streamable-http clients", async () => {
    const response = await request(app)
      .get("/mcp")
      .set("Authorization", "Bearer mcp-token-user-1")
      .buffer(false)
      .parse((res, done) => {
        res.once("data", () => {
          (res as typeof res & { destroy(): void }).destroy();
          done(null, "");
        });
      })
      .expect(200);

    expect(response.headers["content-type"]).toContain("text/event-stream");
  });
});
