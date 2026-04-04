import type { SoftInference, ProjectContext } from "../types";
import { callLlm, LlmProviderNotConfiguredError } from "./llmService";
import { createLogger } from "../infra/logging/logger";

const log = createLogger("adaptationLlmInference");

// ─── Constants ──────────────────────────────────────────────────────────────

const LLM_INFERENCE_CONFIDENCE_THRESHOLD = 0.6;

// ─── Service ────────────────────────────────────────────────────────────────

export class AdaptationLlmInferenceService {
  /**
   * Infer project intent and suggest starter sections based on project content.
   *
   * This is a SOFT inference — it never feeds the UserAdaptationProfile directly.
   * It is only used when behavioral confidence is low (< 0.4) and the result
   * is reversible and non-destructive.
   *
   * Returns null if the LLM provider is not configured.
   */
  async inferProjectIntent(input: {
    projectName: string;
    projectDescription?: string | null;
    taskTitles: string[];
    existingSectionNames: string[];
  }): Promise<SoftInference | null> {
    try {
      const response = await callLlm({
        systemPrompt: this._buildSystemPrompt(),
        userPrompt: this._buildUserPrompt(input),
        maxTokens: 300,
        temperature: 0.3,
      });

      return this._parseLlmResponse(response);
    } catch (err) {
      if (err instanceof LlmProviderNotConfiguredError) {
        log.debug("LLM provider not configured, skipping soft inference", {
          projectName: input.projectName,
        });
        return null;
      }

      log.warn("LLM inference failed for project intent", {
        projectName: input.projectName,
        error: (err as Error).message,
      });
      return null;
    }
  }

  /**
   * Suggest starter sections for a new or sparse project.
   * Returns an empty array if the LLM provider is not configured.
   */
  async suggestStarterSections(input: {
    projectName: string;
    projectDescription?: string | null;
    taskTitles: string[];
  }): Promise<string[]> {
    try {
      const response = await callLlm({
        systemPrompt: `You are a helpful project organization assistant. Suggest 2-4 starter sections for a project. Return ONLY a JSON array of section name strings. No explanation, no markdown.`,
        userPrompt: this._buildSuggestionPrompt(input),
        maxTokens: 150,
        temperature: 0.4,
      });

      return this._parseSectionSuggestion(response);
    } catch (err) {
      if (err instanceof LlmProviderNotConfiguredError) {
        return [];
      }

      log.warn("LLM section suggestion failed", {
        projectName: input.projectName,
        error: (err as Error).message,
      });
      return [];
    }
  }

  /**
   * Determine the recommended hint style for guidance prompts.
   * Only used when behavioral confidence is low.
   */
  async recommendHintStyle(input: {
    projectName: string;
    taskCount: number;
    sectionCount: number;
    hasDates: boolean;
  }): Promise<"minimal" | "supportive" | "structured"> {
    try {
      const response = await callLlm({
        systemPrompt: `You recommend how much guidance to show for a project. Return ONLY one word: "minimal", "supportive", or "structured". No explanation.

- minimal: for simple, self-evident projects
- supportive: for projects that could benefit from light guidance
- structured: for complex projects that need clear organization`,
        userPrompt: `Project: "${input.projectName}"
Tasks: ${input.taskCount}
Sections: ${input.sectionCount}
Has dates: ${input.hasDates}

What guidance style is appropriate?`,
        maxTokens: 10,
        temperature: 0.2,
      });

      const trimmed = response.trim().toLowerCase();
      if (["minimal", "supportive", "structured"].includes(trimmed)) {
        return trimmed as "minimal" | "supportive" | "structured";
      }
      return "supportive";
    } catch (err) {
      if (err instanceof LlmProviderNotConfiguredError) {
        return "supportive";
      }
      log.warn("LLM hint style recommendation failed", {
        projectName: input.projectName,
        error: (err as Error).message,
      });
      return "supportive";
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  private _buildSystemPrompt(): string {
    return `You analyze project content and infer the project's intent and type.
Return ONLY a JSON object with these fields:
- inferredProjectType: string (e.g. "trip planning", "event planning", "work project", "home improvement", "learning goal")
- suggestedSections: string[] (2-4 suggested section names, or empty array if project is too vague)
- recommendedHintStyle: "minimal" | "supportive" | "structured"
- confidence: number (0.0-1.0, how confident you are in this inference)

No explanation, no markdown. Return only valid JSON.`;
  }

  private _buildUserPrompt(input: {
    projectName: string;
    projectDescription?: string | null;
    taskTitles: string[];
    existingSectionNames: string[];
  }): string {
    const lines: string[] = [];
    lines.push(`Project: "${input.projectName}"`);

    if (input.projectDescription) {
      lines.push(`Description: "${input.projectDescription}"`);
    }

    if (input.taskTitles.length > 0) {
      lines.push(`Tasks (${input.taskTitles.length}):`);
      const titles = input.taskTitles.slice(0, 15);
      for (const t of titles) {
        lines.push(`  - ${t}`);
      }
      if (input.taskTitles.length > 15) {
        lines.push(`  ... and ${input.taskTitles.length - 15} more`);
      }
    }

    if (input.existingSectionNames.length > 0) {
      lines.push(`Existing sections: ${input.existingSectionNames.join(", ")}`);
    }

    if (input.taskTitles.length === 0 && !input.projectDescription) {
      lines.push("(No tasks or description yet — infer from name only)");
    }

    return lines.join("\n");
  }

  private _buildSuggestionPrompt(input: {
    projectName: string;
    projectDescription?: string | null;
    taskTitles: string[];
  }): string {
    const lines: string[] = [];
    lines.push(`Suggest starter sections for: "${input.projectName}"`);

    if (input.projectDescription) {
      lines.push(`Description: "${input.projectDescription}"`);
    }

    if (input.taskTitles.length > 0) {
      lines.push(`Existing tasks:`);
      for (const t of input.taskTitles.slice(0, 10)) {
        lines.push(`  - ${t}`);
      }
    }

    return lines.join("\n");
  }

  private _parseLlmResponse(response: string): SoftInference {
    try {
      // Strip markdown code blocks if present
      const cleaned = response
        .replace(/^```json\s*/m, "")
        .replace(/^```\s*/m, "")
        .replace(/\s*```\s*$/m, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      return {
        inferredProjectType:
          typeof parsed.inferredProjectType === "string"
            ? parsed.inferredProjectType
            : undefined,
        suggestedSections: Array.isArray(parsed.suggestedSections)
          ? parsed.suggestedSections.filter(
              (s: unknown) => typeof s === "string",
            )
          : [],
        recommendedHintStyle: ["minimal", "supportive", "structured"].includes(
          parsed.recommendedHintStyle,
        )
          ? parsed.recommendedHintStyle
          : undefined,
        confidence:
          typeof parsed.confidence === "number"
            ? Math.max(0, Math.min(1, parsed.confidence))
            : 0.5,
      };
    } catch {
      log.warn("Failed to parse LLM inference response as JSON", {
        response: response.slice(0, 200),
      });
      return {
        confidence: 0,
      };
    }
  }

  private _parseSectionSuggestion(response: string): string[] {
    try {
      const cleaned = response
        .replace(/^```json\s*/m, "")
        .replace(/^```\s*/m, "")
        .replace(/\s*```\s*$/m, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.filter((s: unknown) => typeof s === "string");
      }
      return [];
    } catch {
      // Try to extract section names from plain text (one per line)
      return response
        .split("\n")
        .map((line) => line.replace(/^[-*•]\s*/, "").trim())
        .filter((line) => line.length > 0 && line.length < 50)
        .slice(0, 5);
    }
  }
}
