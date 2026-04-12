// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOpener,
  getThinkingLine,
  getEmptyState,
  getErrorLine,
  formatWithVoice,
} from "./voiceEngine";
import type { AgentProfile } from "./types";

function makeAgent(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: "test-agent",
    name: "Test Agent",
    role: "test",
    colors: { stroke: "#000", bg: "#fff", text: "#000" },
    traits: { tone: "calm" as const },
    quote: "Test quote",
    voice: {
      openers: ["Hello!", "Hey there"],
      thinkingLines: ["Thinking...", "Let me check"],
      emptyStateLines: ["Nothing here yet", "All clear"],
      errorLines: ["Something went wrong", "Error occurred"],
      tone: "measured" as const,
      avgWordsPerSentence: 8,
    },
    ...overrides,
  };
}

describe("voiceEngine", () => {
  describe("getOpener", () => {
    it("returns one of the agent's openers", () => {
      const agent = makeAgent();
      const opener = getOpener(agent);
      expect(["Hello!", "Hey there"]).toContain(opener);
    });
  });

  describe("getThinkingLine", () => {
    it("returns one of the agent's thinking lines", () => {
      const agent = makeAgent();
      const line = getThinkingLine(agent);
      expect(["Thinking...", "Let me check"]).toContain(line);
    });
  });

  describe("getEmptyState", () => {
    it("returns one of the agent's empty state lines", () => {
      const agent = makeAgent();
      const line = getEmptyState(agent);
      expect(["Nothing here yet", "All clear"]).toContain(line);
    });
  });

  describe("getErrorLine", () => {
    it("returns one of the agent's error lines", () => {
      const agent = makeAgent();
      const line = getErrorLine(agent);
      expect(["Something went wrong", "Error occurred"]).toContain(line);
    });
  });

  describe("formatWithVoice", () => {
    it("returns raw text for unrecognized tone", () => {
      const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "unknown" as any } });
      const result = formatWithVoice(agent, "Hello world.");
      expect(result).toBe("Hello world.");
    });

    describe("blunt/terse tone", () => {
      it("strips sentences exceeding max word count", () => {
        const agent = makeAgent({
          voice: { ...(makeAgent().voice), tone: "blunt", avgWordsPerSentence: 5 },
        });
        const result = formatWithVoice(agent, "Short. This is a very long sentence with many words.");
        expect(result).toBe("Short.");
      });

      it("removes opinion phrases at start of sentences", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "terse" } });
        const result = formatWithVoice(agent, "I think this is important.");
        expect(result).toBe("this is important.");
      });
    });

    describe("measured/reflective tone", () => {
      it("removes leading 'I' from sentences", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "measured" } });
        const result = formatWithVoice(agent, "I believe we should proceed.");
        expect(result).toBe("Believe we should proceed.");
      });

      it("capitalizes first letter after removing 'I'", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "measured" } });
        const result = formatWithVoice(agent, "I think we should go.");
        expect(result).toBe("Think we should go.");
      });
    });

    describe("warm tone", () => {
      it("allows one exclamation mark", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "warm" } });
        const result = formatWithVoice(agent, "Great job! Well done.");
        expect(result).toBe("Great job! Well done.");
      });

      it("removes extra exclamation marks beyond one", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "warm" } });
        const result = formatWithVoice(agent, "Great! Excellent! Super!");
        expect(result).toBe("Great! Excellent. Super.");
      });
    });

    describe("rapid tone", () => {
      it("breaks long sentences into fragments joined by dashes", () => {
        const agent = makeAgent({
          voice: { ...(makeAgent().voice), tone: "rapid", avgWordsPerSentence: 4 },
        });
        const result = formatWithVoice(agent, "This is a long sentence, and it has many words.");
        expect(result).toContain("—");
      });

      it("keeps short sentences intact", () => {
        const agent = makeAgent({ voice: { ...(makeAgent().voice), tone: "rapid" } });
        const result = formatWithVoice(agent, "Short. Good.");
        expect(result).toBe("Short. — Good.");
      });
    });

    it("handles empty input", () => {
      const agent = makeAgent();
      const result = formatWithVoice(agent, "");
      expect(result).toBe("");
    });
  });
});
