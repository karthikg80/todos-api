// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabBar } from "./useTabBar";

const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((k) => store[k] ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((k, v) => { store[k] = v; });
});

describe("useTabBar", () => {
  it("defaults to focus tab", () => {
    const { result } = renderHook(() => useTabBar());
    expect(result.current.activeTab).toBe("focus");
  });

  it("switches tabs", () => {
    const { result } = renderHook(() => useTabBar());
    act(() => result.current.setActiveTab("today"));
    expect(result.current.activeTab).toBe("today");
  });

  it("defaults custom tab to triage (Desk)", () => {
    const { result } = renderHook(() => useTabBar());
    expect(result.current.customView).toBe("triage");
  });

  it("persists custom view to localStorage", () => {
    const { result } = renderHook(() => useTabBar());
    act(() => result.current.setCustomView("horizon"));
    expect(result.current.customView).toBe("horizon");
    expect(store["mobile:customTab"]).toBe("horizon");
  });

  it("restores custom view from localStorage", () => {
    store["mobile:customTab"] = "completed";
    const { result } = renderHook(() => useTabBar());
    expect(result.current.customView).toBe("completed");
  });
});
