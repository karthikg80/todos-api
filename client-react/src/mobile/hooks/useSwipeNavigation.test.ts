import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useSwipeNavigation } from "./useSwipeNavigation";

describe("useSwipeNavigation", () => {
  it("starts at index 0", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    expect(result.current.activeIndex).toBe(0);
  });

  it("advances index on commitNext", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(1);
  });

  it("decrements index on commitPrev", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goNext());
    act(() => result.current.goPrev());
    expect(result.current.activeIndex).toBe(0);
  });

  it("clamps at 0 when going prev", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    act(() => result.current.goPrev());
    expect(result.current.activeIndex).toBe(0);
  });

  it("clamps at count-1 when going next", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 3 }));
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(2);
  });

  it("blocks navigation when locked", () => {
    const { result } = renderHook(() =>
      useSwipeNavigation({ count: 5, locked: true }),
    );
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(0);
  });

  it("reports isDragging false initially", () => {
    const { result } = renderHook(() => useSwipeNavigation({ count: 5 }));
    expect(result.current.isDragging).toBe(false);
  });
});
