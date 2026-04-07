import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiCall, buildUrl } from "./client";
import * as pageTransitions from "../utils/pageTransitions";

vi.mock("../utils/pageTransitions");

const originalLocation = window.location;
const originalFetch = global.fetch;

describe("api/client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock fetch globally
    global.fetch = vi.fn();
    // Mock location.origin
    Object.defineProperty(window, "location", {
      value: { origin: "http://localhost:3000" },
      writable: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  describe("apiCall", () => {
    it("includes auth token header when present", async () => {
      localStorage.setItem("authToken", "token-123");
      vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      await apiCall("/todos");

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/todos",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        }),
      );
    });

    it("does not include auth header when no token", async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      await apiCall("/auth/register", { method: "POST" });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/auth/register",
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });

    it("merges custom headers", async () => {
      vi.mocked(global.fetch).mockResolvedValue(new Response("{}", { status: 200 }));

      await apiCall("/todos", {
        headers: { "X-Custom": "value" },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Custom": "value",
          }),
        }),
      );
    });

    it("refreshes token on 401 and retries request", async () => {
      localStorage.setItem("authToken", "old-token");
      localStorage.setItem("refreshToken", "refresh-123");
      const mockFetch = vi.mocked(global.fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ token: "new-token", refreshToken: "new-refresh" }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(new Response("{}", { status: 200 }));

      const res = await apiCall("/todos");

      expect(res.status).toBe(200);
      // First call: original with old token (401)
      // Second call: refresh
      // Third call: retry with new token
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(localStorage.getItem("authToken")).toBe("new-token");
    });

    it("returns 401 response when no refresh token (caller handles navigation)", async () => {
      localStorage.setItem("authToken", "token-123");
      vi.mocked(global.fetch).mockResolvedValue(new Response("Unauthorized", { status: 401 }));

      const res = await apiCall("/todos");

      expect(res.status).toBe(401);
      // No navigation — caller handles the 401
      expect(vi.mocked(pageTransitions.navigateWithFade)).not.toHaveBeenCalled();
    });

    it("navigates to auth on 401 when refresh fails", async () => {
      localStorage.setItem("authToken", "old-token");
      localStorage.setItem("refreshToken", "refresh-123");
      const mockFetch = vi.mocked(global.fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 })); // refresh fails

      await apiCall("/todos");

      expect(vi.mocked(pageTransitions.navigateWithFade)).toHaveBeenCalledWith(
        "/auth?next=/app",
        { replace: true },
      );
    });

    it("deduplicates concurrent refresh requests", async () => {
      localStorage.setItem("authToken", "old-token");
      localStorage.setItem("refreshToken", "refresh-123");
      const mockFetch = vi.mocked(global.fetch);
      let resolveRefresh: (value: Response) => void;
      const refreshPromise = new Promise<Response>((r) => {
        resolveRefresh = r;
      });
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockImplementation(() => refreshPromise as any);

      // Fire two concurrent calls that both get 401
      const call1 = apiCall("/todos");
      const call2 = apiCall("/users/me");

      // Resolve the refresh
      resolveRefresh!(
        new Response(JSON.stringify({ token: "new", refreshToken: "new-refresh" }), {
          status: 200,
        }),
      );
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 })); // retry for call1
      mockFetch.mockResolvedValueOnce(new Response("{}", { status: 200 })); // retry for call2

      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // Only 3 fetches: original 401, refresh, 2 retries = but the refresh is deduplicated
      // So: call1-401, refresh, call1-retry, call2-retry = 4 total
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("clears all auth storage on refresh failure", async () => {
      localStorage.setItem("authToken", "old-token");
      localStorage.setItem("refreshToken", "refresh-123");
      localStorage.setItem("user", JSON.stringify({ id: "u1" }));
      const mockFetch = vi.mocked(global.fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockRejectedValueOnce(new Error("Network error"));

      await apiCall("/todos");

      expect(localStorage.getItem("authToken")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("clears all auth storage on refresh 401", async () => {
      localStorage.setItem("authToken", "old-token");
      localStorage.setItem("refreshToken", "refresh-123");
      localStorage.setItem("user", JSON.stringify({ id: "u1" }));
      const mockFetch = vi.mocked(global.fetch);
      mockFetch
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
        .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

      await apiCall("/todos");

      expect(localStorage.getItem("authToken")).toBeNull();
      expect(localStorage.getItem("refreshToken")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("buildUrl", () => {
    it("returns path unchanged with no params", () => {
      expect(buildUrl("/todos")).toBe("/todos");
    });

    it("appends query params", () => {
      expect(buildUrl("/todos", { projectId: "proj-1", completed: false })).toBe(
        "/todos?projectId=proj-1&completed=false",
      );
    });

    it("omits null and undefined params", () => {
      expect(buildUrl("/todos", { projectId: null, status: undefined, completed: true })).toBe(
        "/todos?completed=true",
      );
    });

    it("omits empty string params", () => {
      expect(buildUrl("/todos", { projectId: "", status: "next" })).toBe("/todos?status=next");
    });

    it("handles numeric params", () => {
      expect(buildUrl("/todos", { limit: 20, offset: 0 })).toBe("/todos?limit=20&offset=0");
    });
  });
});
