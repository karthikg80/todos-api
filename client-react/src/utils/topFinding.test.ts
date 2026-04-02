import { describe, it, expect } from "vitest";
import { computeTopFinding, dupGroupKey, taxSimilarKey } from "./topFinding";
import type { TuneUpData } from "../types/tuneup";

const EMPTY: TuneUpData = { duplicates: null, stale: null, quality: null, taxonomy: null };
const NONE = new Set<string>();

describe("computeTopFinding", () => {
  it("returns null for all-null data", () => {
    expect(computeTopFinding(EMPTY, NONE, NONE, NONE)).toBeNull();
  });

  it("returns null for all-empty results", () => {
    const data: TuneUpData = {
      duplicates: { groups: [], totalTasks: 0 },
      stale: { staleTasks: [], staleProjects: [] },
      quality: { results: [], totalAnalyzed: 0 },
      taxonomy: { similarProjects: [], smallProjects: [] },
    };
    expect(computeTopFinding(data, NONE, NONE, NONE)).toBeNull();
  });

  it("ranks exact duplicates (tier 1) over stale (tier 3+)", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [{
          confidence: 1.0, reason: "Exact", suggestedAction: "archive-older",
          tasks: [{ id: "t1", title: "Foo", status: "next", projectId: null }, { id: "t2", title: "Foo", status: "next", projectId: null }],
        }],
        totalTasks: 10,
      },
      stale: { staleTasks: [{ id: "t3", title: "Old", lastUpdated: "2025-01-01" }], staleProjects: [] },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.tier).toBe(1);
    expect(result?.section).toBe("duplicates");
    expect(result?.severity).toBe("danger");
  });

  it("separates exact (tier 1) from near (tier 4) duplicates by confidence", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [
          { confidence: 0.7, reason: "Similar", suggestedAction: "review", tasks: [{ id: "t1", title: "A", status: "next", projectId: "p1" }, { id: "t2", title: "B", status: "next", projectId: "p1" }] },
        ],
        totalTasks: 10,
      },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.tier).toBe(4);
  });

  it("excludes dismissed findings", () => {
    const data: TuneUpData = {
      ...EMPTY,
      duplicates: {
        groups: [{ confidence: 1.0, reason: "Exact", suggestedAction: "archive-older", tasks: [{ id: "t1", title: "Foo", status: "next", projectId: null }, { id: "t2", title: "Foo", status: "next", projectId: null }] }],
        totalTasks: 10,
      },
    };
    const dismissed = new Set(["dup:t1:t2"]);
    expect(computeTopFinding(data, dismissed, NONE, NONE)).toBeNull();
  });

  it("excludes patched-out tasks", () => {
    const data: TuneUpData = {
      ...EMPTY,
      stale: { staleTasks: [{ id: "t1", title: "Old", lastUpdated: "2025-01-01" }], staleProjects: [] },
    };
    expect(computeTopFinding(data, NONE, new Set(["t1"]), NONE)).toBeNull();
  });

  it("breaks ties by count", () => {
    const data: TuneUpData = {
      ...EMPTY,
      quality: {
        results: [
          { id: "t1", title: "A", qualityScore: 3, issues: ["vague"], suggestions: [] },
          { id: "t2", title: "B", qualityScore: 3, issues: ["too long"], suggestions: [] },
        ],
        totalAnalyzed: 10,
      },
      taxonomy: { similarProjects: [], smallProjects: [{ name: "Tiny", id: "p1", taskCount: 1 }] },
    };
    const result = computeTopFinding(data, NONE, NONE, NONE);
    expect(result?.section).toBe("quality");
    expect(result?.count).toBe(2);
  });
});

describe("dupGroupKey", () => {
  it("sorts task IDs for stability", () => {
    expect(dupGroupKey(["t2", "t1"])).toBe("dup:t1:t2");
    expect(dupGroupKey(["t1", "t2"])).toBe("dup:t1:t2");
  });
});

describe("taxSimilarKey", () => {
  it("sorts project IDs", () => {
    expect(taxSimilarKey("p2", "p1")).toBe("tax:similar:p1:p2");
  });

  it("falls back to names when IDs are missing", () => {
    expect(taxSimilarKey(undefined, undefined, "Beta", "Alpha")).toBe("tax:similar:Alpha:Beta");
  });

  it("prefers IDs over names", () => {
    expect(taxSimilarKey("p2", "p1", "Beta", "Alpha")).toBe("tax:similar:p1:p2");
  });
});
