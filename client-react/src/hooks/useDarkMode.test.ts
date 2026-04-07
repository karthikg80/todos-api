import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDarkMode } from "./useDarkMode";

describe("useDarkMode", () => {
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    document.body.classList.remove("dark-mode");

    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();

    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("defaults to light mode when no stored preference and system is light", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(false);
    });

    it("defaults to dark mode when no stored preference and system is dark", () => {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(true);
    });

    it("uses stored preference over system preference", () => {
      localStorage.setItem("darkMode", "false");
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(false);
    });

    it("uses stored 'true' preference", () => {
      localStorage.setItem("darkMode", "true");
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(true);
    });
  });

  describe("toggle", () => {
    it("toggles dark mode", () => {
      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.dark).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.dark).toBe(false);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useDarkMode());

      act(() => {
        result.current.toggle();
      });
      expect(localStorage.getItem("darkMode")).toBe("true");

      act(() => {
        result.current.toggle();
      });
      expect(localStorage.getItem("darkMode")).toBe("false");
    });

    it("toggles the dark-mode class on document.body", () => {
      const { result } = renderHook(() => useDarkMode());

      act(() => {
        result.current.toggle();
      });
      expect(document.body.classList.contains("dark-mode")).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(document.body.classList.contains("dark-mode")).toBe(false);
    });
  });

  describe("system theme changes", () => {
    it("registers a change listener on mount", () => {
      renderHook(() => useDarkMode());
      expect(mockAddEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("removes the listener on unmount", () => {
      const { unmount } = renderHook(() => useDarkMode());
      unmount();
      expect(mockRemoveEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    it("registers a change listener on mount", () => {
      let capturedHandler: ((e: { matches: boolean }) => void) | undefined;
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: (_e: string, h: (e: { matches: boolean }) => void) => {
          capturedHandler = h;
        },
        removeEventListener: vi.fn(),
      }));

      const { unmount } = renderHook(() => useDarkMode());

      // Handler is registered and will check localStorage before switching
      expect(capturedHandler).toBeDefined();

      unmount();
    });

    it("does not auto-switch when user has manual preference", () => {
      localStorage.setItem("darkMode", "false");
      let changeHandler: ((e: { matches: boolean }) => void) | undefined;
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: (_e: string, h: (e: { matches: boolean }) => void) => {
          changeHandler = h;
        },
        removeEventListener: vi.fn(),
      }));

      const { result } = renderHook(() => useDarkMode());
      expect(result.current.dark).toBe(false);

      act(() => {
        changeHandler!({ matches: true });
      });
      expect(result.current.dark).toBe(false);
    });
  });
});
