// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePalette, PALETTES } from "./usePalette";

const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((k) => store[k] ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((k, v) => { store[k] = v; });
});

describe("usePalette", () => {
  it("defaults to amber", () => {
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("amber");
  });

  it("changes palette", () => {
    const { result } = renderHook(() => usePalette());
    act(() => result.current.setPalette("violet"));
    expect(result.current.palette).toBe("violet");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => usePalette());
    act(() => result.current.setPalette("teal"));
    expect(store["mobile:palette"]).toBe("teal");
  });

  it("restores from localStorage", () => {
    store["mobile:palette"] = "coral";
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("coral");
  });

  it("falls back to amber for invalid stored value", () => {
    store["mobile:palette"] = "invalid";
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("amber");
  });

  it("exports PALETTES metadata", () => {
    expect(PALETTES).toHaveLength(4);
    expect(PALETTES[0].key).toBe("amber");
    expect(PALETTES[0].label).toBe("Sunset Amber");
  });
});
