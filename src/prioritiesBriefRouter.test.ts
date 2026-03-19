import express from "express";
import request from "supertest";
import {
  createPrioritiesBriefRouter,
  resetPrioritiesBriefCacheForTests,
} from "./routes/prioritiesBriefRouter";
import { callLlm } from "./services/llmService";

jest.mock("./services/llmService", () => {
  const actual = jest.requireActual("./services/llmService");
  return {
    ...actual,
    callLlm: jest.fn(),
  };
});

describe("prioritiesBriefRouter", () => {
  const mockedCallLlm = callLlm as jest.MockedFunction<typeof callLlm>;
  let app: express.Express;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));
    resetPrioritiesBriefCacheForTests();
    mockedCallLlm.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const todoService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: "todo-1",
          title: "Prepare launch checklist",
          priority: "high",
          dueDate: "2026-03-20T15:00:00.000Z",
          status: "open",
          category: "Work",
        },
      ]),
    };
    const projectService = {
      findAll: jest
        .fn()
        .mockResolvedValue([
          { id: "proj-1", name: "Work", area: "work", openTaskCount: 1 },
        ]),
    };

    app = express();
    app.use(
      "/ai",
      createPrioritiesBriefRouter({
        todoService: todoService as any,
        projectService: projectService as any,
        resolveUserId: () => "user-1",
      }),
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("serves stale cached HTML immediately while a background refresh is in flight", async () => {
    mockedCallLlm.mockResolvedValueOnce("<div>Initial brief</div>");

    const initial = await request(app).get("/ai/priorities-brief").expect(200);

    expect(initial.body.html).toBe("<div>Initial brief</div>");
    expect(initial.body.cached).toBe(false);
    expect(initial.body.isStale).toBe(false);
    expect(initial.body.refreshInFlight).toBe(false);

    jest.setSystemTime(new Date("2026-03-19T16:00:01.000Z"));

    let resolveRefresh: (value: string) => void = () => {};
    mockedCallLlm.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const stale = await request(app).get("/ai/priorities-brief").expect(200);

    expect(stale.body.html).toBe("<div>Initial brief</div>");
    expect(stale.body.cached).toBe(true);
    expect(stale.body.isStale).toBe(true);
    expect(stale.body.refreshInFlight).toBe(true);
    expect(stale.body.staleAt).toBeDefined();
    expect(stale.body.expiresAt).toBeDefined();

    resolveRefresh("<div>Fresh brief</div>");
    await Promise.resolve();
    await Promise.resolve();

    const refreshed = await request(app)
      .get("/ai/priorities-brief")
      .expect(200);

    expect(refreshed.body.html).toBe("<div>Fresh brief</div>");
    expect(refreshed.body.isStale).toBe(false);
    expect(refreshed.body.refreshInFlight).toBe(false);
  });

  it("refresh endpoint keeps the current snapshot visible while a forced refresh runs", async () => {
    mockedCallLlm.mockResolvedValueOnce("<div>Initial brief</div>");

    await request(app).get("/ai/priorities-brief").expect(200);

    let resolveRefresh: (value: string) => void = () => {};
    mockedCallLlm.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const refreshResponse = await request(app)
      .post("/ai/priorities-brief/refresh")
      .expect(202);

    expect(refreshResponse.body.ok).toBe(true);
    expect(refreshResponse.body.refreshStarted).toBe(true);
    expect(refreshResponse.body.html).toBe("<div>Initial brief</div>");
    expect(refreshResponse.body.refreshInFlight).toBe(true);

    resolveRefresh("<div>Refreshed brief</div>");
    await Promise.resolve();
    await Promise.resolve();

    const refreshed = await request(app)
      .get("/ai/priorities-brief")
      .expect(200);
    expect(refreshed.body.html).toBe("<div>Refreshed brief</div>");
  });
});
