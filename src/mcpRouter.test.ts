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
    create: jest.fn<Promise<Project>, [string, CreateProjectDto]>(),
    update: jest.fn<
      Promise<Project | null>,
      [string, string, UpdateProjectDto]
    >(),
    delete: jest.fn<
      Promise<boolean>,
      [string, string, ProjectTaskDisposition]
    >(),
  };
}

function buildMcpSession(scopes: McpScope[]) {
  return {
    userId: "user-1",
    email: "user@example.com",
    tokenType: "mcp" as const,
    scopes,
    assistantName: "ChatGPT",
  };
}

describe("Remote MCP router", () => {
  let app: Express;
  let todoService: TodoService;
  let projectService: jest.Mocked<IProjectService>;
  let mockAuthService: {
    verifyToken: jest.Mock;
    createMcpToken: jest.Mock;
    verifyMcpToken: jest.Mock;
  };

  beforeEach(() => {
    todoService = new TodoService();
    projectService = createProjectServiceMock();
    mockAuthService = {
      verifyToken: jest
        .fn()
        .mockReturnValue({ userId: "user-1", email: "user@example.com" }),
      createMcpToken: jest.fn().mockReturnValue({
        token: "mcp-token-1",
        scopes: ["read", "write"],
        expiresAt: "2026-04-09T00:00:00.000Z",
        assistantName: "ChatGPT",
      }),
      verifyMcpToken: jest.fn().mockReturnValue(buildMcpSession(["read"])),
    };

    app = createApp(
      todoService,
      mockAuthService as any,
      undefined,
      undefined,
      undefined,
      undefined,
      projectService,
    );
  });

  it("issues scoped MCP tokens for authenticated users", async () => {
    const response = await request(app)
      .post("/auth/mcp/token")
      .set("Authorization", "Bearer app-access-token")
      .send({ scopes: ["write"], assistantName: "ChatGPT" })
      .expect(201);

    expect(mockAuthService.createMcpToken).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      scopes: ["read", "write"],
      assistantName: "ChatGPT",
    });
    expect(response.body).toEqual({
      token: "mcp-token-1",
      scopes: ["read", "write"],
      expiresAt: "2026-04-09T00:00:00.000Z",
      assistantName: "ChatGPT",
    });
  });

  it("initializes the stateless MCP surface for an authenticated user", async () => {
    const response = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer mcp-token-1")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "ChatGPT", version: "1.0" },
        },
      })
      .expect(200);

    expect(response.body.result.protocolVersion).toBe("2025-11-25");
    expect(response.body.result.capabilities.tools.listChanged).toBe(false);
    expect(response.body.result.serverInfo.name).toBe("todos-api-mcp");
  });

  it("lists only read tools for read-scoped MCP tokens", async () => {
    mockAuthService.verifyMcpToken.mockReturnValue(buildMcpSession(["read"]));

    const response = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer mcp-token-1")
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      })
      .expect(200);

    const toolNames = response.body.result.tools.map(
      (tool: { name: string }) => tool.name,
    );
    expect(toolNames).toContain("list_tasks");
    expect(toolNames).toContain("list_projects");
    expect(toolNames).not.toContain("create_task");
    expect(toolNames).not.toContain("create_project");
  });

  it("rejects write tools for read-scoped MCP tokens with structured errors", async () => {
    mockAuthService.verifyMcpToken.mockReturnValue(buildMcpSession(["read"]));

    const response = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer mcp-token-1")
      .send({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "create_task",
          arguments: { title: "Blocked write" },
        },
      })
      .expect(200);

    expect(response.body.result.isError).toBe(true);
    expect(response.body.result.structuredContent.error.code).toBe(
      "MCP_SCOPE_REQUIRED",
    );
  });

  it("reuses the internal agent layer for create_task with MCP idempotency and logging", async () => {
    mockAuthService.verifyMcpToken.mockReturnValue(
      buildMcpSession(["read", "write"]),
    );
    const logSpy = jest.spyOn(console, "info").mockImplementation(() => {});

    const firstResponse = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer mcp-token-1")
      .send({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "create_task",
          arguments: {
            title: "MCP task",
            idempotencyKey: "mcp-create-task-1",
          },
        },
      })
      .expect(200);

    const replayResponse = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer mcp-token-1")
      .send({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "create_task",
          arguments: {
            title: "MCP task",
            idempotencyKey: "mcp-create-task-1",
          },
        },
      })
      .expect(200);

    expect(
      firstResponse.body.result.structuredContent.data.task.id,
    ).toBeDefined();
    expect(replayResponse.body.result.structuredContent.data.task.id).toBe(
      firstResponse.body.result.structuredContent.data.task.id,
    );
    expect(replayResponse.body.result.structuredContent.trace.replayed).toBe(
      true,
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"type":"assistant_mcp_call"'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"toolName":"create_task"'),
    );

    logSpy.mockRestore();
  });
});
