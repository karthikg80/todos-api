// @vitest-environment jsdom
import { ce } from "../../test-helpers";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AgentSigil } from "./AgentSigil";

const drawAgentAvatar = vi.fn();

vi.mock("../../agents/avatarEngine", () => ({
  drawAgentAvatar: (...args: unknown[]) => drawAgentAvatar(...args),
}));

describe("AgentSigil", () => {
  let origGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    drawAgentAvatar.mockClear();
    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      scale: vi.fn(),
      fillStyle: "",
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
      stroke: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it("draws registered agent via avatar engine", async () => {
    render(
      ce(AgentSigil, { agentId: "orla", color: "#111", bg: "#eee", size: 32 }),
    );
    await waitFor(() => {
      expect(drawAgentAvatar).toHaveBeenCalled();
    });
  });

  it("falls back to circle for unknown agent id", async () => {
    const ctx = {
      scale: vi.fn(),
      fillStyle: "",
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeStyle: "",
      lineWidth: 0,
      stroke: vi.fn(),
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctx,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    render(
      ce(AgentSigil, {
        agentId: "no-such-agent",
        color: "#00f",
        bg: "#ddd",
        size: 24,
      }),
    );
    await waitFor(() => {
      expect(ctx.arc).toHaveBeenCalled();
      expect(drawAgentAvatar).not.toHaveBeenCalled();
    });
  });
});
