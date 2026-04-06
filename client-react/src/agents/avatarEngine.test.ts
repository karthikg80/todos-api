import { describe, it, expect } from "vitest";
import { drawAgentAvatar, startAnimation } from "./avatarEngine";
import type { AgentProfile } from "./types";

const mockAgent: AgentProfile = {
  id: "kodo",
  name: "KŌDO",
  role: "focus guardian",
  traits: ["disciplined", "quiet", "fierce"],
  quote: "Not now.",
  superpower: "Shields deep work",
  quirk: "Sometimes blocks needed things",
  bestCalledWhen: "You need 2 unbroken hours",
  colors: {
    stroke: "#3A3A38",
    bg: "#F4F3F0",
    textDark: "#2C2C2A",
    traitBg: "#E8E7E3",
  },
  voice: {
    tone: "terse",
    avgWordsPerSentence: 5,
    openers: ["Focus."],
    closers: ["."],
    thinkingLines: ["..."],
    emptyStateLines: ["Ready."],
    errorLines: ["Error."],
  },
  avatarSeed: 111,
};

describe("avatarEngine", () => {
  it("drawAgentAvatar does not throw", () => {
    const ops: string[] = [];
    const ctx = {
      beginPath: () => ops.push("beginPath"),
      moveTo: () => ops.push("moveTo"),
      lineTo: () => ops.push("lineTo"),
      arc: () => ops.push("arc"),
      stroke: () => ops.push("stroke"),
      fill: () => ops.push("fill"),
      clearRect: () => ops.push("clearRect"),
      set strokeStyle(_: string) {
        ops.push("strokeStyle");
      },
      set fillStyle(_: string) {
        ops.push("fillStyle");
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

    expect(() => drawAgentAvatar(ctx, 80, mockAgent, "idle")).not.toThrow();
    expect(ops.length).toBeGreaterThan(0);
  });

  it("kodo draws exactly 2 arcs (plus background circle)", () => {
    const arcCalls: number[] = [];
    const ctx = {
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => arcCalls.push(1),
      stroke: () => {},
      fill: () => {},
      clearRect: () => {},
      set strokeStyle(_: string) {},
      set fillStyle(_: string) {},
      set lineWidth(_: number) {},
      set globalAlpha(_: number) {},
      set lineCap(_: string) {},
      set lineJoin(_: string) {},
    } as unknown as CanvasRenderingContext2D;

    drawAgentAvatar(ctx, 80, mockAgent, "idle");
    // 1 for background circle + 2 for kodo's strokes = 3
    expect(arcCalls).toHaveLength(3);
  });

  it("startAnimation returns a cleanup function", () => {
    const canvas = {
      getContext: () => null,
      width: 80,
      height: 80,
    } as unknown as HTMLCanvasElement;

    const cleanup = startAnimation(canvas, mockAgent);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
