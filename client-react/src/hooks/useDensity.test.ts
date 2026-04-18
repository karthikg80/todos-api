import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDensity, type Density } from "./useDensity";

describe("useDensity", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("initial state", () => {
    it("defaults to 'normal' when no stored preference", () => {
      const { result } = renderHook(() => useDensity());
      expect(result.current.density).toBe("normal");
    });

    it("uses stored preference when present", () => {
      localStorage.setItem("todos:density", "compact");
      const { result } = renderHook(() => useDensity());
      expect(result.current.density).toBe("compact");
    });

    it("handles stored 'spacious' preference", () => {
      localStorage.setItem("todos:density", "spacious");
      const { result } = renderHook(() => useDensity());
      expect(result.current.density).toBe("spacious");
    });
  });

  describe("setDensity", () => {
    it("updates the density value", () => {
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.setDensity("compact");
      });
      expect(result.current.density).toBe("compact");
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.setDensity("spacious");
      });
      expect(localStorage.getItem("todos:density")).toBe("spacious");
    });

    it("sets data-density attribute on document.documentElement", () => {
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.setDensity("compact");
      });
      expect(document.documentElement.dataset.density).toBe("compact");
    });
  });

  describe("per-view keys", () => {
    it("reads from `todos:density:<viewKey>` when a key is provided", () => {
      localStorage.setItem("todos:density:today", "spacious");
      const { result } = renderHook(() => useDensity("today"));
      expect(result.current.density).toBe("spacious");
    });

    it("falls back to the global key when a per-view value is not yet stored", () => {
      localStorage.setItem("todos:density", "compact");
      const { result } = renderHook(() => useDensity("inbox"));
      expect(result.current.density).toBe("compact");
    });

    it("writes to the per-view key when set, not the global one", () => {
      localStorage.setItem("todos:density", "normal");
      const { result } = renderHook(() => useDensity("inbox"));
      act(() => {
        result.current.setDensity("spacious");
      });
      expect(localStorage.getItem("todos:density:inbox")).toBe("spacious");
      expect(localStorage.getItem("todos:density")).toBe("normal");
    });

    it("reloads when the view key changes", () => {
      localStorage.setItem("todos:density:today", "compact");
      localStorage.setItem("todos:density:upcoming", "spacious");
      const { result, rerender } = renderHook(({ key }: { key: string }) => useDensity(key), {
        initialProps: { key: "today" },
      });
      expect(result.current.density).toBe("compact");
      rerender({ key: "upcoming" });
      expect(result.current.density).toBe("spacious");
    });
  });

  describe("cycle", () => {
    it("cycles compact → normal → spacious → compact", () => {
      localStorage.setItem("todos:density", "compact");
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.cycle();
      });
      expect(result.current.density).toBe("normal");

      act(() => {
        result.current.cycle();
      });
      expect(result.current.density).toBe("spacious");

      act(() => {
        result.current.cycle();
      });
      expect(result.current.density).toBe("compact");
    });

    it("cycles from default 'normal'", () => {
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.cycle();
      });
      expect(result.current.density).toBe("spacious");
    });

    it("persists each cycle to localStorage", () => {
      const { result } = renderHook(() => useDensity());

      act(() => {
        result.current.cycle();
      });
      expect(localStorage.getItem("todos:density")).toBe("spacious");

      act(() => {
        result.current.cycle();
      });
      expect(localStorage.getItem("todos:density")).toBe("compact");
    });
  });
});
