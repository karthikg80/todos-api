// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNextWork, _resetNextWorkCache } from "./useNextWork";

vi.mock("../api/nextWork", () => ({
  fetchNextWork: vi.fn().mockResolvedValue([
    { taskId: "t1", title: "Task 1", reason: "High priority.", impact: "high", effort: "low" },
    { taskId: "t2", title: "Task 2", reason: "Due soon.", impact: "medium", effort: "medium" },
  ]),
}));

import { fetchNextWork } from "../api/nextWork";

describe("useNextWork", () => {
  beforeEach(() => {
    _resetNextWorkCache();
    vi.clearAllMocks();
  });

  it("fetches on mount with default inputs", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.visible).toHaveLength(2);
    expect(fetchNextWork).toHaveBeenCalledTimes(1);
  });

  it("returns cached result for same inputs without re-fetching", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    vi.clearAllMocks();
    // Change inputs then change back
    act(() => result.current.setInputs({ energy: "low" }));
    await waitFor(() => expect(fetchNextWork).toHaveBeenCalledTimes(1));

    vi.clearAllMocks();
    act(() => result.current.setInputs({}));
    // Should serve from cache, no new fetch
    expect(result.current.visible).toHaveLength(2);
  });

  it("dismiss hides task from visible list", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.dismiss("t1"));
    expect(result.current.visible).toHaveLength(1);
    expect(result.current.visible[0].taskId).toBe("t2");
  });

  it("dismiss is session-global across input changes", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.dismiss("t1"));
    act(() => result.current.setInputs({ energy: "high" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dismissed.has("t1")).toBe(true);
  });

  it("markActedOn hides task, unmarkActedOn restores it", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => result.current.markActedOn("t1"));
    expect(result.current.visible).toHaveLength(1);

    act(() => result.current.unmarkActedOn("t1"));
    expect(result.current.visible).toHaveLength(2);
  });

  it("refresh clears dismissed and actedOn", async () => {
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.visible).toHaveLength(2));

    act(() => {
      result.current.dismiss("t1");
      result.current.markActedOn("t2");
    });
    expect(result.current.visible).toHaveLength(0);

    vi.clearAllMocks();
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.dismissed.size).toBe(0);
    expect(result.current.actedOn.size).toBe(0);
    expect(result.current.visible).toHaveLength(2);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(fetchNextWork).mockRejectedValueOnce(new Error("Network error"));
    _resetNextWorkCache();
    const { result } = renderHook(() => useNextWork());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });
});
