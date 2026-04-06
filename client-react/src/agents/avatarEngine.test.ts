import { describe, it, expect } from "vitest";
import { drawAgentAvatar, AVATAR_AGENTS } from "./avatarEngine";

describe("avatarEngine", () => {
  it("exports draw functions for all 6 agents", () => {
    expect(AVATAR_AGENTS).toEqual([
      "orla",
      "finn",
      "mira",
      "echo",
      "sol",
      "kodo",
    ]);
  });

  it("drawAgentAvatar does not throw for any agent", () => {
    const ops: string[] = [];
    const ctx = {
      beginPath: () => ops.push("beginPath"),
      moveTo: () => ops.push("moveTo"),
      lineTo: () => ops.push("lineTo"),
      arc: () => ops.push("arc"),
      stroke: () => ops.push("stroke"),
      set strokeStyle(_: string) {
        ops.push("strokeStyle");
      },
      set lineWidth(_: number) {
        ops.push("lineWidth");
      },
      set globalAlpha(_: number) {
        ops.push("globalAlpha");
      },
      set lineCap(_: string) {
        ops.push("lineCap");
      },
      set lineJoin(_: string) {
        ops.push("lineJoin");
      },
    } as unknown as CanvasRenderingContext2D;

    for (const id of AVATAR_AGENTS) {
      ops.length = 0;
      expect(() => drawAgentAvatar(ctx, id, 40, 40, "#000")).not.toThrow();
      expect(ops.length).toBeGreaterThan(0);
    }
  });

  it("kodo draws exactly 2 arcs", () => {
    const arcCalls: number[] = [];
    const ctx = {
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => arcCalls.push(1),
      stroke: () => {},
      set strokeStyle(_: string) {},
      set lineWidth(_: number) {},
      set globalAlpha(_: number) {},
      set lineCap(_: string) {},
      set lineJoin(_: string) {},
    } as unknown as CanvasRenderingContext2D;

    drawAgentAvatar(ctx, "kodo", 40, 40, "#000");
    expect(arcCalls).toHaveLength(2);
  });
});
