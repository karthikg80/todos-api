import type { AgentProfile } from "./types";

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

export function getOpener(agent: AgentProfile): string {
  return pick(agent.voice.openers);
}

export function getThinkingLine(agent: AgentProfile): string {
  return pick(agent.voice.thinkingLines);
}

export function getEmptyState(agent: AgentProfile): string {
  return pick(agent.voice.emptyStateLines);
}

export function getErrorLine(agent: AgentProfile): string {
  return pick(agent.voice.errorLines);
}

export function formatWithVoice(agent: AgentProfile, raw: string): string {
  const { tone, avgWordsPerSentence } = agent.voice;
  const maxWords = Math.ceil(avgWordsPerSentence * 1.4);

  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (tone) {
    case "blunt":
    case "terse": {
      // Strip long sentences, prefer active voice
      const filtered = sentences
        .filter((s) => wordCount(s) <= maxWords)
        .map((s) => s.replace(/^(I think|I believe|In my opinion,?)\s*/i, ""));
      return filtered.length > 0 ? filtered.join(" ") : sentences[0] || raw;
    }

    case "measured":
    case "reflective": {
      // Allow longer sentences, ensure no sentence starts with "I"
      return sentences
        .map((s) => {
          if (/^I\s/.test(s)) {
            return s.replace(/^I\s+/, "");
            // capitalize first letter
          }
          return s;
        })
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" ");
    }

    case "warm": {
      // Allow exclamations sparingly — max 1 per response
      let exclCount = 0;
      return sentences
        .map((s) => {
          if (s.endsWith("!")) {
            exclCount++;
            if (exclCount > 1) return s.slice(0, -1) + ".";
          }
          return s;
        })
        .join(" ");
    }

    case "rapid": {
      // Break into short punchy fragments, prefer dashes
      return sentences
        .flatMap((s) => {
          if (wordCount(s) > maxWords) {
            // Split on commas or conjunctions
            return s.split(/,\s*|\s+(?:and|but|or)\s+/).map((f) => f.trim());
          }
          return [s];
        })
        .filter(Boolean)
        .join(" — ");
    }

    default:
      return raw;
  }
}
