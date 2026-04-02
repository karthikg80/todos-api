// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { useViewSnapshot, ViewSnapshotContext } from "./useViewSnapshot";

function makeWrapper(registerCapture: (fn: () => unknown) => void, snapshot: unknown | null) {
  return ({ children }: { children: React.ReactNode }) =>
    createElement(ViewSnapshotContext.Provider, { value: { registerCapture, snapshot } }, children);
}

describe("useViewSnapshot", () => {
  it("registers capture callback on mount", () => {
    const register = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({ x: 1 }), restore: () => {}, version: 1 }),
      { wrapper: makeWrapper(register, null) },
    );
    expect(register).toHaveBeenCalledTimes(1);
    const captureWrapped = register.mock.calls[0][0];
    expect(captureWrapped()).toEqual({ _v: 1, data: { x: 1 } });
  });

  it("calls restore once with matching version snapshot", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 2 }),
      { wrapper: makeWrapper(() => {}, { _v: 2, data: { scrollTop: 100 } }) },
    );
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledWith({ scrollTop: 100 });
  });

  it("skips restore on version mismatch", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 3 }),
      { wrapper: makeWrapper(() => {}, { _v: 2, data: { scrollTop: 100 } }) },
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("skips restore when snapshot is null", () => {
    const restore = vi.fn();
    renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 1 }),
      { wrapper: makeWrapper(() => {}, null) },
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it("does not call restore on re-render", () => {
    const restore = vi.fn();
    const { rerender } = renderHook(
      () => useViewSnapshot({ capture: () => ({}), restore, version: 1 }),
      { wrapper: makeWrapper(() => {}, { _v: 1, data: { x: 1 } }) },
    );
    rerender();
    rerender();
    expect(restore).toHaveBeenCalledTimes(1);
  });
});
