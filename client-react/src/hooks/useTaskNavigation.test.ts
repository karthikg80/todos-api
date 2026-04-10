// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { useReducer, renderHook, act } from "@testing-library/react";
import { useTaskNavigation, taskNavReducer, INITIAL_STATE } from "./useTaskNavigation";

describe("taskNavReducer", () => {
  it("starts in collapsed mode", () => {
    expect(INITIAL_STATE).toEqual({ mode: "collapsed" });
  });

  it("opens quick edit", () => {
    const state = taskNavReducer(INITIAL_STATE, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    expect(state).toEqual({ mode: "quickEdit", taskId: "task-1" });
  });

  it("opens drawer", () => {
    const state = taskNavReducer(INITIAL_STATE, { type: "OPEN_DRAWER", taskId: "task-1" });
    expect(state).toEqual({ mode: "drawer", taskId: "task-1" });
  });

  it("opens full page", () => {
    const state = taskNavReducer(INITIAL_STATE, { type: "OPEN_FULL_PAGE", taskId: "task-1" });
    expect(state).toEqual({ mode: "fullPage", taskId: "task-1" });
  });

  it("collapses back to collapsed", () => {
    const withDrawer = taskNavReducer(INITIAL_STATE, { type: "OPEN_DRAWER", taskId: "task-1" });
    const collapsed = taskNavReducer(withDrawer, { type: "COLLAPSE" });
    expect(collapsed).toEqual({ mode: "collapsed" });
  });

  it("toggles quick edit off when clicking same task", () => {
    const open = taskNavReducer(INITIAL_STATE, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    const toggle = taskNavReducer(open, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    expect(toggle).toEqual({ mode: "collapsed" });
  });

  it("switches quick edit to a different task", () => {
    const open = taskNavReducer(INITIAL_STATE, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    const switchTask = taskNavReducer(open, { type: "OPEN_QUICK_EDIT", taskId: "task-2" });
    expect(switchTask).toEqual({ mode: "quickEdit", taskId: "task-2" });
  });

  it("escalates from quick edit to drawer", () => {
    const open = taskNavReducer(INITIAL_STATE, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    const escalated = taskNavReducer(open, { type: "ESCALATE" });
    expect(escalated).toEqual({ mode: "drawer", taskId: "task-1" });
  });

  it("escalates from drawer to full page", () => {
    const open = taskNavReducer(INITIAL_STATE, { type: "OPEN_DRAWER", taskId: "task-1" });
    const escalated = taskNavReducer(open, { type: "ESCALATE" });
    expect(escalated).toEqual({ mode: "fullPage", taskId: "task-1" });
  });

  it("escalates from collapsed with focused task", () => {
    const escalated = taskNavReducer(INITIAL_STATE, { type: "ESCALATE", focusedTaskId: "task-1" });
    expect(escalated).toEqual({ mode: "quickEdit", taskId: "task-1" });
  });

  it("does nothing when escalating from collapsed without focused task", () => {
    const escalated = taskNavReducer(INITIAL_STATE, { type: "ESCALATE" });
    expect(escalated).toEqual({ mode: "collapsed" });
  });

  it("does nothing when escalating from full page", () => {
    const full = taskNavReducer(INITIAL_STATE, { type: "OPEN_FULL_PAGE", taskId: "task-1" });
    const escalated = taskNavReducer(full, { type: "ESCALATE" });
    expect(escalated).toEqual({ mode: "fullPage", taskId: "task-1" });
  });

  it("deescalates from full page to drawer", () => {
    const full = taskNavReducer(INITIAL_STATE, { type: "OPEN_FULL_PAGE", taskId: "task-1" });
    const deescalated = taskNavReducer(full, { type: "DEESCALATE" });
    expect(deescalated).toEqual({ mode: "drawer", taskId: "task-1" });
  });

  it("deescalates from drawer to quick edit", () => {
    const drawer = taskNavReducer(INITIAL_STATE, { type: "OPEN_DRAWER", taskId: "task-1" });
    const deescalated = taskNavReducer(drawer, { type: "DEESCALATE" });
    expect(deescalated).toEqual({ mode: "quickEdit", taskId: "task-1" });
  });

  it("deescalates from quick edit to collapsed", () => {
    const qe = taskNavReducer(INITIAL_STATE, { type: "OPEN_QUICK_EDIT", taskId: "task-1" });
    const deescalated = taskNavReducer(qe, { type: "DEESCALATE" });
    expect(deescalated).toEqual({ mode: "collapsed" });
  });

  it("does nothing when deescalating from collapsed", () => {
    const deescalated = taskNavReducer(INITIAL_STATE, { type: "DEESCALATE" });
    expect(deescalated).toEqual({ mode: "collapsed" });
  });
});

describe("useTaskNavigation", () => {
  it("returns collapsed state initially", () => {
    const { result } = renderHook(() => useTaskNavigation());
    expect(result.current.state.mode).toBe("collapsed");
    expect(result.current.activeTaskId).toBeNull();
  });

  it("opens quick edit and exposes activeTaskId", () => {
    const { result } = renderHook(() => useTaskNavigation());
    act(() => result.current.openQuickEdit("task-1"));
    expect(result.current.state.mode).toBe("quickEdit");
    expect(result.current.activeTaskId).toBe("task-1");
  });

  it("escalates through all tiers", () => {
    const { result } = renderHook(() => useTaskNavigation());
    act(() => result.current.openQuickEdit("task-1"));
    act(() => result.current.escalate());
    expect(result.current.state.mode).toBe("drawer");
    act(() => result.current.escalate());
    expect(result.current.state.mode).toBe("fullPage");
  });

  it("deescalates through all tiers", () => {
    const { result } = renderHook(() => useTaskNavigation());
    act(() => result.current.openFullPage("task-1"));
    act(() => result.current.deescalate());
    expect(result.current.state.mode).toBe("drawer");
    act(() => result.current.deescalate());
    expect(result.current.state.mode).toBe("quickEdit");
    act(() => result.current.deescalate());
    expect(result.current.state.mode).toBe("collapsed");
  });

  it("collapses from any state", () => {
    const { result } = renderHook(() => useTaskNavigation());
    act(() => result.current.openFullPage("task-1"));
    act(() => result.current.collapse());
    expect(result.current.state.mode).toBe("collapsed");
  });
});
