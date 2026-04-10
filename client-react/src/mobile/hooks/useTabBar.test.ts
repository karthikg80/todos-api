// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTabBar } from "./useTabBar";

beforeEach(() => {
  localStorage.clear();
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

  it("defaults custom tab to horizon (Upcoming)", () => {
    const { result } = renderHook(() => useTabBar());
    expect(result.current.customView).toBe("horizon");
  });

  it("persists custom view to localStorage", () => {
    const { result } = renderHook(() => useTabBar());
    act(() => result.current.setCustomView("horizon"));
    expect(result.current.customView).toBe("horizon");
    expect(localStorage.getItem("mobile:customTab")).toBe("horizon");
  });

  it("restores custom view from localStorage", () => {
    localStorage.setItem("mobile:customTab", "completed");
    const { result } = renderHook(() => useTabBar());
    expect(result.current.customView).toBe("completed");
  });
});
