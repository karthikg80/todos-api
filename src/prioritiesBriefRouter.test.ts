import express from "express";
import request from "supertest";
import { InMemoryAiSuggestionStore } from "./services/aiSuggestionStore";
import { createPrioritiesBriefRouter } from "./routes/prioritiesBriefRouter";

function buildHomeFocusOutput() {
  return {
    requestId: "req-home-focus",
    surface: "home_focus" as const,
    must_abstain: false,
    suggestions: [
      {
        type: "focus_task" as const,
        confidence: 0.91,
        rationale:
          "This is overdue and should be resolved before more work slips.",
        suggestionId: "home-focus-1",
        payload: {
          taskId: "todo-1",
          todoId: "todo-1",
          title: "Finalize travel dates",
          summary:
            "This is overdue and should be resolved before more work slips.",
          reason:
            "This is overdue and should be resolved before more work slips.",
          source: "deterministic",
        },
      },
    ],
  };
}

describe("prioritiesBriefRouter", () => {
  it("uses a recent prewarmed home_focus snapshot before calling the LLM route", async () => {
    const suggestionStore = new InMemoryAiSuggestionStore();
    const suggestion = await suggestionStore.create({
      userId: "user-1",
      type: "task_critic",
      input: {
        surface: "home_focus",
        source: "automation_prewarm",
      },
      output: buildHomeFocusOutput() as unknown as Record<string, unknown>,
    });

    const app = express();
    app.use(
      createPrioritiesBriefRouter({
        todoService: {
          findAll: jest.fn().mockResolvedValue([]),
        } as any,
        projectService: {
          findAll: jest.fn().mockResolvedValue([]),
        } as any,
        suggestionStore,
        resolveUserId: () => "user-1",
      }),
    );

    const response = await request(app).get("/priorities-brief").expect(200);

    expect(response.body.prewarmed).toBe(true);
    expect(response.body.cached).toBe(true);
    expect(response.body.generatedAt).toBe(suggestion.createdAt.toISOString());
    expect(String(response.body.html || "")).toContain("Next priorities");
    expect(String(response.body.html || "")).toContain("Finalize travel dates");
  });
});
