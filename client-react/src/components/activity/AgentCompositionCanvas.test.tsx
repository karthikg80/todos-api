// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import { AgentCompositionCanvas } from "./AgentCompositionCanvas";

// Mock the algorithms module to avoid actual canvas drawing
vi.mock("../GenerativePattern/algorithms", () => ({
  mkRng: vi.fn().mockReturnValue(() => Math.random()),
  arcRivers: vi.fn(),
}));

// Mock AGENTS registry
vi.mock("../../agents/registry", () => ({
  AGENTS: {
    orla: { id: "orla", name: "Orla", colors: { stroke: "#ff6b6b", bg: "#fff5f5", textDark: "#333", traitBg: "#ffe0e0" } },
    finn: { id: "finn", name: "Finn", colors: { stroke: "#4ecdc4", bg: "#f0fffe", textDark: "#333", traitBg: "#d0f5f2" } },
    mira: { id: "mira", name: "Mira", colors: { stroke: "#45b7d1", bg: "#f0f9fc", textDark: "#333", traitBg: "#d0ecf5" } },
    echo: { id: "echo", name: "Echo", colors: { stroke: "#96ceb4", bg: "#f5faf7", textDark: "#333", traitBg: "#e0f0e8" } },
    sol: { id: "sol", name: "Sol", colors: { stroke: "#feca57", bg: "#fffdf0", textDark: "#333", traitBg: "#fff0c0" } },
    kodo: { id: "kodo", name: "Kodo", colors: { stroke: "#ff9ff3", bg: "#fff0fc", textDark: "#333", traitBg: "#ffe0fa" } },
  },
}));

describe("AgentCompositionCanvas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a canvas element", () => {
    render(React.createElement(AgentCompositionCanvas));
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();
  });

  it("canvas has absolute positioning style", () => {
    render(React.createElement(AgentCompositionCanvas));
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();
    expect(canvas?.style.position).toBe("absolute");
  });

  it("canvas fills container with inset 0", () => {
    render(React.createElement(AgentCompositionCanvas));
    const canvas = document.querySelector("canvas");
    expect(canvas).toBeTruthy();
    // The style uses inset: 0, width: 100%, height: 100%
    expect(canvas?.style.width).toBe("100%");
    expect(canvas?.style.height).toBe("100%");
  });

  it("cleans up animation frame on unmount", async () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(React.createElement(AgentCompositionCanvas));
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    unmount();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });
});
