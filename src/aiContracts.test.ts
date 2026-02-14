import { validateDecisionAssistOutput } from "./aiContracts";
import { ValidationError } from "./validation";

describe("validateDecisionAssistOutput", () => {
  it("accepts a valid on_create payload", () => {
    const result = validateDecisionAssistOutput({
      requestId: "req-1",
      surface: "on_create",
      must_abstain: false,
      suggestions: [
        {
          type: "set_priority",
          confidence: 0.8,
          rationale: "Urgency language detected",
          payload: { priority: "high" },
        },
      ],
    });

    expect(result.surface).toBe("on_create");
    expect(result.suggestions).toHaveLength(1);
  });

  it("rejects unknown suggestion type", () => {
    expect(() =>
      validateDecisionAssistOutput({
        requestId: "req-2",
        surface: "task_drawer",
        must_abstain: false,
        suggestions: [
          {
            type: "bulk_delete",
            confidence: 0.7,
            rationale: "Unsafe",
            payload: {},
          },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it("rejects too many subtasks", () => {
    expect(() =>
      validateDecisionAssistOutput({
        requestId: "req-3",
        surface: "task_drawer",
        must_abstain: false,
        suggestions: [
          {
            type: "split_subtasks",
            confidence: 0.75,
            rationale: "Task is broad",
            payload: {
              subtasks: [
                { title: "One", order: 1 },
                { title: "Two", order: 2 },
                { title: "Three", order: 3 },
                { title: "Four", order: 4 },
                { title: "Five", order: 5 },
                { title: "Six", order: 6 },
              ],
            },
          },
        ],
      }),
    ).toThrow("payload.subtasks must contain between 1 and 5 items");
  });

  it("rejects more than one clarification question", () => {
    expect(() =>
      validateDecisionAssistOutput({
        requestId: "req-4",
        surface: "on_create",
        must_abstain: false,
        suggestions: [
          {
            type: "ask_clarification",
            confidence: 0.5,
            rationale: "Need due date",
            payload: { question: "When?", choices: ["Today", "This week"] },
          },
          {
            type: "ask_clarification",
            confidence: 0.5,
            rationale: "Need priority",
            payload: { question: "Priority?", choices: ["High", "Medium"] },
          },
        ],
      }),
    ).toThrow("At most one ask_clarification suggestion is allowed");
  });

  it("accepts today plan with planPreview", () => {
    const result = validateDecisionAssistOutput({
      requestId: "req-5",
      surface: "today_plan",
      must_abstain: false,
      suggestions: [
        {
          type: "defer_task",
          confidence: 0.62,
          rationale: "Reduce overload",
          payload: { strategy: "next_week" },
        },
      ],
      planPreview: {
        topN: 3,
        items: [
          { rank: 1, rationale: "Highest impact", timeEstimateMin: 45 },
          {
            rank: 2,
            rationale: "Unblocks dependent work",
            timeEstimateMin: 30,
          },
          { rank: 3, rationale: "Quick win", timeEstimateMin: 20 },
        ],
      },
    });

    expect(result.planPreview?.items).toHaveLength(3);
  });
});
