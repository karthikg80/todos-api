// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  mkRng,
  flowField,
  scatteredOrbits,
  arcRivers,
  spiralField,
  hashSeed,
  ALGORITHMS,
} from "./algorithms";
import type { DrawFn } from "./types";

// Mock canvas context
function mockCtx() {
  const calls = {
    beginPath: 0,
    stroke: 0,
    arc: 0,
    bezierCurveTo: 0,
    lineTo: 0,
  };
  return {
    beginPath: () => { calls.beginPath++; },
    moveTo: () => {},
    lineTo: () => { calls.lineTo++; },
    bezierCurveTo: () => { calls.bezierCurveTo++; },
    arc: () => { calls.arc++; },
    stroke: () => { calls.stroke++; },
    fillRect: () => {},
    clearRect: () => {},
    setTransform: () => {},
    fill: () => {},
    save: () => {},
    restore: () => {},
    closePath: () => {},
    rect: () => {},
    lineWidth: 1,
    globalAlpha: 1,
    strokeStyle: "#000",
    fillStyle: "#000",
    lineCap: "butt",
    lineJoin: "miter",
    calls,
  } as unknown as CanvasRenderingContext2D & { calls: typeof calls };
}

describe("GenerativePattern algorithms", () => {
  describe("mkRng", () => {
    it("produces deterministic values for same seed", () => {
      const rng1 = mkRng(42);
      const rng2 = mkRng(42);
      expect(rng1()).toBe(rng2());
      expect(rng1()).toBe(rng2());
    });

    it("produces different values for different seeds", () => {
      const rng1 = mkRng(42);
      const rng2 = mkRng(99);
      expect(rng1()).not.toBe(rng2());
    });

    it("produces values between 0 and 1", () => {
      const rng = mkRng(12345);
      for (let i = 0; i < 100; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe("hashSeed", () => {
    it("produces consistent hash for same string", () => {
      expect(hashSeed("test")).toBe(hashSeed("test"));
    });

    it("produces different hashes for different strings", () => {
      expect(hashSeed("hello")).not.toBe(hashSeed("world"));
    });

    it("returns positive number", () => {
      expect(hashSeed("negative test")).toBeGreaterThanOrEqual(0);
    });

    it("handles empty string", () => {
      expect(hashSeed("")).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ALGORITHMS export", () => {
    it("exports all four algorithms", () => {
      expect(ALGORITHMS).toHaveProperty("flowField");
      expect(ALGORITHMS).toHaveProperty("scatteredOrbits");
      expect(ALGORITHMS).toHaveProperty("arcRivers");
      expect(ALGORITHMS).toHaveProperty("spiralField");
    });
  });

  describe("flowField", () => {
    it("calls canvas methods", () => {
      const ctx = mockCtx();
      const rng = mkRng(42);
      flowField(ctx, 200, 100, 0.5, 5, rng);
      expect(ctx.calls.beginPath).toBeGreaterThan(0);
      expect(ctx.calls.stroke).toBeGreaterThan(0);
    });

    it("scales line count with density", () => {
      const ctx1 = mockCtx();
      const ctx2 = mockCtx();
      const rng1 = mkRng(42);
      const rng2 = mkRng(42);
      flowField(ctx1, 200, 100, 0.5, 2, rng1);
      flowField(ctx2, 200, 100, 0.5, 10, rng2);
      expect(ctx2.calls.beginPath).toBeGreaterThan(ctx1.calls.beginPath);
    });
  });

  describe("scatteredOrbits", () => {
    it("calls canvas methods", () => {
      const ctx = mockCtx();
      const rng = mkRng(42);
      scatteredOrbits(ctx, 200, 100, 0.5, 5, rng);
      expect(ctx.calls.beginPath).toBeGreaterThan(0);
      expect(ctx.calls.arc).toBeGreaterThan(0);
    });

    it("scales orbit count with density", () => {
      const ctx1 = mockCtx();
      const ctx2 = mockCtx();
      const rng1 = mkRng(42);
      const rng2 = mkRng(42);
      scatteredOrbits(ctx1, 200, 100, 0.5, 2, rng1);
      scatteredOrbits(ctx2, 200, 100, 0.5, 10, rng2);
      expect(ctx2.calls.beginPath).toBeGreaterThan(ctx1.calls.beginPath);
    });
  });

  describe("arcRivers", () => {
    it("calls canvas methods", () => {
      const ctx = mockCtx();
      const rng = mkRng(42);
      arcRivers(ctx, 200, 100, 0.5, 5, rng);
      expect(ctx.calls.beginPath).toBeGreaterThan(0);
      expect(ctx.calls.bezierCurveTo).toBeGreaterThan(0);
    });

    it("scales river count with density", () => {
      const ctx1 = mockCtx();
      const ctx2 = mockCtx();
      const rng1 = mkRng(42);
      const rng2 = mkRng(42);
      arcRivers(ctx1, 200, 100, 0.5, 2, rng1);
      arcRivers(ctx2, 200, 100, 0.5, 10, rng2);
      expect(ctx2.calls.beginPath).toBeGreaterThan(ctx1.calls.beginPath);
    });
  });

  describe("spiralField", () => {
    it("calls canvas methods", () => {
      const ctx = mockCtx();
      const rng = mkRng(42);
      spiralField(ctx, 200, 100, 0.5, 5, rng);
      expect(ctx.calls.beginPath).toBeGreaterThan(0);
      expect(ctx.calls.lineTo).toBeGreaterThan(0);
    });

    it("scales spiral count with density", () => {
      const ctx1 = mockCtx();
      const ctx2 = mockCtx();
      const rng1 = mkRng(42);
      const rng2 = mkRng(42);
      spiralField(ctx1, 200, 100, 0.5, 2, rng1);
      spiralField(ctx2, 200, 100, 0.5, 10, rng2);
      expect(ctx2.calls.beginPath).toBeGreaterThan(ctx1.calls.beginPath);
    });
  });
});
