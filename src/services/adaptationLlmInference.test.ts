import { AdaptationLlmInferenceService } from "./adaptationLlmInference";
import * as llmService from "./llmService";

// Mock the LLM service
jest.mock("./llmService", () => ({
  callLlm: jest.fn(),
  LlmProviderNotConfiguredError: class LlmProviderNotConfiguredError extends Error {
    constructor() {
      super("AI provider not configured");
      this.name = "LlmProviderNotConfiguredError";
    }
  },
}));

const mockCallLlm = llmService.callLlm as jest.MockedFunction<typeof llmService.callLlm>;
const MockLlmProviderNotConfiguredError = llmService.LlmProviderNotConfiguredError;

describe("AdaptationLlmInferenceService", () => {
  let service: AdaptationLlmInferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdaptationLlmInferenceService();
  });

  describe("inferProjectIntent", () => {
    it("returns parsed inference from valid LLM response", async () => {
      mockCallLlm.mockResolvedValue(JSON.stringify({
        inferredProjectType: "trip planning",
        suggestedSections: ["Flights", "Accommodation", "Itinerary"],
        recommendedHintStyle: "structured",
        confidence: 0.85,
      }));

      const result = await service.inferProjectIntent({
        projectName: "Japan Trip",
        projectDescription: "Planning a 2-week trip to Japan",
        taskTitles: ["Book flights", "Research hotels"],
        existingSectionNames: [],
      });

      expect(result).not.toBeNull();
      expect(result!.inferredProjectType).toBe("trip planning");
      expect(result!.suggestedSections).toEqual(["Flights", "Accommodation", "Itinerary"]);
      expect(result!.recommendedHintStyle).toBe("structured");
      expect(result!.confidence).toBe(0.85);
    });

    it("returns null when LLM provider not configured", async () => {
      mockCallLlm.mockRejectedValue(new MockLlmProviderNotConfiguredError());

      const result = await service.inferProjectIntent({
        projectName: "Test Project",
        taskTitles: [],
        existingSectionNames: [],
      });

      expect(result).toBeNull();
    });

    it("returns null on LLM error", async () => {
      mockCallLlm.mockRejectedValue(new Error("Network error"));

      const result = await service.inferProjectIntent({
        projectName: "Test Project",
        taskTitles: [],
        existingSectionNames: [],
      });

      expect(result).toBeNull();
    });

    it("handles malformed JSON response gracefully", async () => {
      mockCallLlm.mockResolvedValue("not valid json");

      const result = await service.inferProjectIntent({
        projectName: "Test Project",
        taskTitles: ["task 1"],
        existingSectionNames: [],
      });

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0);
    });

    it("strips markdown code blocks from response", async () => {
      mockCallLlm.mockResolvedValue(
        '```json\n{"inferredProjectType": "work project", "suggestedSections": [], "recommendedHintStyle": "minimal", "confidence": 0.7}\n```',
      );

      const result = await service.inferProjectIntent({
        projectName: "Q4 Report",
        taskTitles: [],
        existingSectionNames: [],
      });

      expect(result!.inferredProjectType).toBe("work project");
      expect(result!.confidence).toBe(0.7);
    });

    it("clamps confidence to [0, 1]", async () => {
      mockCallLlm.mockResolvedValue(JSON.stringify({
        inferredProjectType: "test",
        suggestedSections: [],
        recommendedHintStyle: "minimal",
        confidence: 1.5,
      }));

      const result = await service.inferProjectIntent({
        projectName: "Test",
        taskTitles: [],
        existingSectionNames: [],
      });

      expect(result!.confidence).toBe(1);
    });

    it("handles missing optional fields gracefully", async () => {
      mockCallLlm.mockResolvedValue(JSON.stringify({
        confidence: 0.5,
      }));

      const result = await service.inferProjectIntent({
        projectName: "Test",
        taskTitles: [],
        existingSectionNames: [],
      });

      expect(result!.inferredProjectType).toBeUndefined();
      expect(result!.suggestedSections).toEqual([]);
      expect(result!.recommendedHintStyle).toBeUndefined();
      expect(result!.confidence).toBe(0.5);
    });

    it("limits task titles in prompt to 15", async () => {
      mockCallLlm.mockResolvedValue(JSON.stringify({
        confidence: 0.5,
      }));

      const taskTitles = Array.from({ length: 20 }, (_, i) => `Task ${i + 1}`);
      await service.inferProjectIntent({
        projectName: "Test",
        taskTitles,
        existingSectionNames: [],
      });

      const callArgs = mockCallLlm.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain("... and 5 more");
      expect(callArgs.userPrompt).toContain("Task 15");
      expect(callArgs.userPrompt).not.toContain("Task 16");
    });
  });

  describe("suggestStarterSections", () => {
    it("returns parsed sections from valid LLM response", async () => {
      mockCallLlm.mockResolvedValue(JSON.stringify(["Planning", "Execution", "Review"]));

      const result = await service.suggestStarterSections({
        projectName: "New Project",
        taskTitles: ["Task 1"],
      });

      expect(result).toEqual(["Planning", "Execution", "Review"]);
    });

    it("returns empty array when LLM provider not configured", async () => {
      mockCallLlm.mockRejectedValue(new MockLlmProviderNotConfiguredError());

      const result = await service.suggestStarterSections({
        projectName: "Test",
        taskTitles: [],
      });

      expect(result).toEqual([]);
    });

    it("falls back to plain text parsing for non-JSON response", async () => {
      mockCallLlm.mockResolvedValue("- Planning\n- Execution\n- Review");

      const result = await service.suggestStarterSections({
        projectName: "Test",
        taskTitles: [],
      });

      expect(result).toContain("Planning");
      expect(result).toContain("Execution");
      expect(result).toContain("Review");
    });

    it("limits sections to 5 from plain text", async () => {
      mockCallLlm.mockResolvedValue(
        "- A\n- B\n- C\n- D\n- E\n- F\n- G",
      );

      const result = await service.suggestStarterSections({
        projectName: "Test",
        taskTitles: [],
      });

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe("recommendHintStyle", () => {
    it("returns valid hint style from LLM response", async () => {
      mockCallLlm.mockResolvedValue("structured");

      const result = await service.recommendHintStyle({
        projectName: "Complex Project",
        taskCount: 20,
        sectionCount: 0,
        hasDates: false,
      });

      expect(result).toBe("structured");
    });

    it("returns supportive for unrecognized response", async () => {
      mockCallLlm.mockResolvedValue("aggressive");

      const result = await service.recommendHintStyle({
        projectName: "Test",
        taskCount: 5,
        sectionCount: 0,
        hasDates: false,
      });

      expect(result).toBe("supportive");
    });

    it("returns supportive when LLM provider not configured", async () => {
      mockCallLlm.mockRejectedValue(new MockLlmProviderNotConfiguredError());

      const result = await service.recommendHintStyle({
        projectName: "Test",
        taskCount: 5,
        sectionCount: 0,
        hasDates: false,
      });

      expect(result).toBe("supportive");
    });
  });
});
