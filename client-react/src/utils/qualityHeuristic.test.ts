import { describe, it, expect } from "vitest";
import { titlePassesQuality } from "./qualityHeuristic";

describe("titlePassesQuality", () => {
  it("accepts well-formed titles", () => {
    expect(titlePassesQuality("Fix login bug on mobile")).toBe(true);
    expect(titlePassesQuality("Add dark mode toggle")).toBe(true);
    expect(titlePassesQuality("Review PR #42")).toBe(true);
  });

  it("rejects titles not starting with an action verb", () => {
    expect(titlePassesQuality("Login bug on mobile")).toBe(false);
    expect(titlePassesQuality("The button is broken")).toBe(false);
  });

  it("rejects titles over 80 characters", () => {
    expect(titlePassesQuality("Fix " + "x".repeat(80))).toBe(false);
  });

  it("rejects titles containing splitting words", () => {
    expect(titlePassesQuality("Fix login and update profile")).toBe(false);
    expect(titlePassesQuality("Deploy build then run tests")).toBe(false);
  });

  it("rejects empty titles", () => {
    expect(titlePassesQuality("")).toBe(false);
    expect(titlePassesQuality("   ")).toBe(false);
  });
});
