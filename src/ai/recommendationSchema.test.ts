import {
  makeRecommendation,
  validateRecommendation,
  RECOMMENDATION_SCHEMA_VERSION,
} from "./recommendationSchema";

describe("recommendationSchema", () => {
  const base = {
    id: "rec-1",
    kind: "task",
    confidence: 0.9,
    why: "Contains a clear actionable verb",
    proposedAction: "create" as const,
    entityRefs: ["task-abc"],
    warnings: [],
    dryRunPatch: null,
  };

  it("makeRecommendation adds schemaVersion", () => {
    const r = makeRecommendation(base);
    expect(r.schemaVersion).toBe(RECOMMENDATION_SCHEMA_VERSION);
    expect(r.id).toBe("rec-1");
  });

  it("validateRecommendation accepts a valid recommendation", () => {
    const r = makeRecommendation(base);
    expect(validateRecommendation(r)).toBe(true);
  });

  it("validateRecommendation rejects confidence out of range (>1)", () => {
    const r = makeRecommendation({ ...base, confidence: 1.5 });
    expect(validateRecommendation(r)).toBe(false);
  });

  it("validateRecommendation rejects confidence out of range (<0)", () => {
    const r = makeRecommendation({ ...base, confidence: -0.1 });
    expect(validateRecommendation(r)).toBe(false);
  });

  it("validateRecommendation rejects missing why", () => {
    const r = { ...makeRecommendation(base), why: undefined };
    expect(validateRecommendation(r)).toBe(false);
  });

  it("validateRecommendation rejects non-array entityRefs", () => {
    const r = { ...makeRecommendation(base), entityRefs: "not-array" };
    expect(validateRecommendation(r)).toBe(false);
  });
});
