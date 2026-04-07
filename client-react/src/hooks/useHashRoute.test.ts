import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHashRoute } from "./useHashRoute";

describe("useHashRoute", () => {
  afterEach(() => {
    window.location.hash = "";
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("returns null taskId when hash is empty", () => {
      window.location.hash = "";
      const { result } = renderHook(() => useHashRoute());
      expect(result.current.taskId).toBeNull();
    });

    it("parses task ID from valid hash", () => {
      window.location.hash = "#/task/abc123-def456";
      const { result } = renderHook(() => useHashRoute());
      expect(result.current.taskId).toBe("abc123-def456");
    });
  });

  describe("hashchange listener lifecycle", () => {
    it("registers a hashchange listener on mount", () => {
      const addEventListener = vi.spyOn(window, "addEventListener");
      renderHook(() => useHashRoute());
      expect(addEventListener).toHaveBeenCalledWith("hashchange", expect.any(Function));
    });

    it("removes the listener on unmount", () => {
      const removeEventListener = vi.spyOn(window, "removeEventListener");
      const { unmount } = renderHook(() => useHashRoute());
      unmount();
      expect(removeEventListener).toHaveBeenCalledWith("hashchange", expect.any(Function));
    });
  });

  describe("navigateToTask", () => {
    it("sets window.location.hash to the task route", () => {
      window.location.hash = "";
      const { result } = renderHook(() => useHashRoute());
      expect(window.location.hash).toBe("");

      act(() => {
        result.current.navigateToTask("task-42");
      });

      expect(window.location.hash).toBe("#/task/task-42");
    });
  });

  describe("clearRoute", () => {
    it("calls pushState to clear the hash without triggering scroll", () => {
      window.location.hash = "";
      const { result } = renderHook(() => useHashRoute());

      const pushState = vi.spyOn(history, "pushState");

      act(() => {
        result.current.clearRoute();
      });

      expect(result.current.taskId).toBeNull();
      expect(pushState).toHaveBeenCalledWith(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    });
  });
});
