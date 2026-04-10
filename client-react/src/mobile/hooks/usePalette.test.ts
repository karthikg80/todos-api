// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePalette, PALETTES } from "./usePalette";

beforeEach(() => {
  localStorage.clear();
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
    expect(localStorage.getItem("mobile:palette")).toBe("teal");
  });

  it("restores from localStorage", () => {
    localStorage.setItem("mobile:palette", "coral");
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("coral");
  });

  it("falls back to amber for invalid stored value", () => {
    localStorage.setItem("mobile:palette", "invalid");
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toBe("amber");
  });

  it("exports PALETTES metadata", () => {
    expect(PALETTES).toHaveLength(4);
    expect(PALETTES[0].key).toBe("amber");
    expect(PALETTES[0].label).toBe("Sunset Amber");
  });
});
