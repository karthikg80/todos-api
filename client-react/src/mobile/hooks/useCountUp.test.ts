// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCountUp } from "./useCountUp";

describe("useCountUp", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("starts at 0", () => {
    const { result } = renderHook(() => useCountUp(42, 800));
    expect(result.current).toBe(0);
  });

  it("reaches target after duration", () => {
    const { result } = renderHook(() => useCountUp(10, 800));
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(result.current).toBe(10);
  });

  it("returns 0 when target is 0", () => {
    const { result } = renderHook(() => useCountUp(0, 800));
    expect(result.current).toBe(0);
  });
});
