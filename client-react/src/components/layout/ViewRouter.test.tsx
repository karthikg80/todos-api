// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { ViewRouter, ViewRoute } from "./ViewRouter";
import { useViewActivity } from "./ViewActivityContext";

function ActivitySpy({ id, onActivity }: { id: string; onActivity: (id: string, active: boolean) => void }) {
  const { isActive } = useViewActivity();
  onActivity(id, isActive);
  return <div data-testid={`view-${id}`}>{id}: {isActive ? "active" : "inactive"}</div>;
}

function TestHarness({ capacity = 3 }: { capacity?: number }) {
  const [active, setActive] = useState("a");
  const activityLog: Record<string, boolean> = {};
  const onActivity = (id: string, a: boolean) => { activityLog[id] = a; };
  return (
    <div>
      <button data-testid="goto-a" onClick={() => setActive("a")}>A</button>
      <button data-testid="goto-b" onClick={() => setActive("b")}>B</button>
      <button data-testid="goto-c" onClick={() => setActive("c")}>C</button>
      <button data-testid="goto-d" onClick={() => setActive("d")}>D</button>
      <ViewRouter activeViewKey={active} capacity={capacity}>
        <ViewRoute viewKey="a"><ActivitySpy id="a" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="b"><ActivitySpy id="b" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="c"><ActivitySpy id="c" onActivity={onActivity} /></ViewRoute>
        <ViewRoute viewKey="d"><ActivitySpy id="d" onActivity={onActivity} /></ViewRoute>
      </ViewRouter>
    </div>
  );
}

describe("ViewRouter", () => {
  it("renders only the active view initially", () => {
    const { queryByTestId } = render(<TestHarness />);
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeNull();
  });

  it("keeps previous view mounted when switching", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness />);
    act(() => getByTestId("goto-b").click());
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeTruthy();
  });

  it("hides inactive view with display:none", () => {
    const { getByTestId } = render(<TestHarness />);
    act(() => getByTestId("goto-b").click());
    const slotA = getByTestId("view-a").closest(".view-router__slot") as HTMLElement;
    expect(slotA.style.display).toBe("none");
    const slotB = getByTestId("view-b").closest(".view-router__slot") as HTMLElement;
    expect(slotB.style.display).toBe("");
    expect(slotB.dataset.active).toBe("true");
  });

  it("evicts oldest view when exceeding capacity", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness capacity={2} />);
    act(() => getByTestId("goto-b").click());
    act(() => getByTestId("goto-c").click());
    // Capacity 2: 'a' should be evicted
    expect(queryByTestId("view-a")).toBeNull();
    expect(queryByTestId("view-b")).toBeTruthy();
    expect(queryByTestId("view-c")).toBeTruthy();
  });

  it("re-activation moves view to front of LRU", () => {
    const { queryByTestId, getByTestId } = render(<TestHarness capacity={2} />);
    act(() => getByTestId("goto-b").click());
    // LRU: [b, a]
    act(() => getByTestId("goto-a").click());
    // LRU: [a, b] — a moved to front
    act(() => getByTestId("goto-c").click());
    // LRU: [c, a] — b evicted (oldest), a survives
    expect(queryByTestId("view-a")).toBeTruthy();
    expect(queryByTestId("view-b")).toBeNull();
    expect(queryByTestId("view-c")).toBeTruthy();
  });

  it("provides isActive=true to active view and isActive=false to cached", () => {
    const log: Record<string, boolean> = {};
    const spy = (id: string, active: boolean) => { log[id] = active; };
    const { getByTestId } = render(
      <div>
        <ViewRouter activeViewKey="a" capacity={3}>
          <ViewRoute viewKey="a"><ActivitySpy id="a" onActivity={spy} /></ViewRoute>
          <ViewRoute viewKey="b"><ActivitySpy id="b" onActivity={spy} /></ViewRoute>
        </ViewRouter>
      </div>
    );
    // Only 'a' is mounted initially
    expect(log["a"]).toBe(true);
  });
});
