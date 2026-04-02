// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBottomSheet } from "./useBottomSheet";

describe("useBottomSheet", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useBottomSheet());
    expect(result.current.snap).toBe("closed");
    expect(result.current.taskId).toBeNull();
  });

  it("opens to half snap with a task id", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => result.current.openHalf("task-1"));
    expect(result.current.snap).toBe("half");
    expect(result.current.taskId).toBe("task-1");
  });

  it("expands from half to full", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => result.current.openHalf("task-1"));
    act(() => result.current.expandFull());
    expect(result.current.snap).toBe("full");
    expect(result.current.taskId).toBe("task-1");
  });

  it("closes from any state", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => result.current.openHalf("task-1"));
    act(() => result.current.expandFull());
    act(() => result.current.close());
    expect(result.current.snap).toBe("closed");
    expect(result.current.taskId).toBeNull();
  });

  it("opening a different task replaces the current one", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => result.current.openHalf("task-1"));
    act(() => result.current.openHalf("task-2"));
    expect(result.current.taskId).toBe("task-2");
    expect(result.current.snap).toBe("half");
  });
});
