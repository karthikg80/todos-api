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
