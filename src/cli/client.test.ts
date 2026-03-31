import fs from "fs";
import path from "path";
import os from "os";

let testDir: string;
jest.mock("os", () => {
  const actual = jest.requireActual("os");
  return {
    ...actual,
    homedir: () => testDir,
  };
});

import { ApiClient, ApiError } from "./client";
import { saveConfig } from "./config";

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "td-client-test-"));
  mockFetch.mockReset();
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

function jsonResponse(data: any, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

describe("ApiClient", () => {
  test("sends GET request with auth header", async () => {
    saveConfig({
      apiUrl: "http://test.api",
      accessToken: "mytoken",
    });

    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1", title: "Test" }));

    const client = new ApiClient("http://test.api");
    const result = await client.get("/todos/1");

    expect(result).toEqual({ id: "1", title: "Test" });
    expect(mockFetch).toHaveBeenCalledWith("http://test.api/todos/1", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer mytoken",
      },
      body: undefined,
    });
  });

  test("sends POST request with body", async () => {
    saveConfig({ apiUrl: "http://test.api", accessToken: "tok" });

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ id: "2", title: "New" }, 201),
    );

    const client = new ApiClient("http://test.api");
    const result = await client.post("/todos", { title: "New" });

    expect(result).toEqual({ id: "2", title: "New" });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe("POST");
    expect(call[1].body).toBe(JSON.stringify({ title: "New" }));
  });

  test("throws ApiError on non-ok response", async () => {
    saveConfig({ apiUrl: "http://test.api" });

    mockFetch.mockResolvedValueOnce(jsonResponse({ error: "Not found" }, 404));

    const client = new ApiClient("http://test.api");
    await expect(client.get("/todos/missing")).rejects.toThrow(ApiError);
    await expect(client.get("/todos/missing")).rejects.toThrow();
  });

  test("attempts token refresh on 401", async () => {
    saveConfig({
      apiUrl: "http://test.api",
      accessToken: "expired",
      refreshToken: "valid-refresh",
    });

    // First call: 401
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ accessToken: "new-token", refreshToken: "new-refresh" }),
    );
    // Retry: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1", title: "Test" }));

    const client = new ApiClient("http://test.api");
    const result = await client.get("/todos/1");

    expect(result).toEqual({ id: "1", title: "Test" });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify refresh was called
    const refreshCall = mockFetch.mock.calls[1];
    expect(refreshCall[0]).toBe("http://test.api/auth/refresh");
    expect(JSON.parse(refreshCall[1].body)).toEqual({
      refreshToken: "valid-refresh",
    });

    // Verify retry used new token
    const retryCall = mockFetch.mock.calls[2];
    expect(retryCall[1].headers.Authorization).toBe("Bearer new-token");
  });

  test("clears auth when refresh fails", async () => {
    saveConfig({
      apiUrl: "http://test.api",
      accessToken: "expired",
      refreshToken: "also-expired",
    });

    // First call: 401
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    // Refresh call: also 401
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "Invalid refresh token" }, 401),
    );

    const client = new ApiClient("http://test.api");
    await expect(client.get("/todos/1")).rejects.toThrow(ApiError);

    // Auth should be cleared
    const { loadConfig } = require("./config");
    const config = loadConfig();
    expect(config.accessToken).toBeUndefined();
    expect(config.refreshToken).toBeUndefined();
  });

  test("works without auth token", async () => {
    saveConfig({ apiUrl: "http://test.api" });

    mockFetch.mockResolvedValueOnce(jsonResponse({ status: "ok" }));

    const client = new ApiClient("http://test.api");
    const result = await client.get("/health");

    expect(result).toEqual({ status: "ok" });
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });
});
