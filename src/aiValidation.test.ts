import {
  validateDecisionAssistLatestQuery,
  validateDecisionAssistStubInput,
} from "./validation/aiValidation";
import { ValidationError } from "./validation/validation";

describe("AI validation", () => {
  it("accepts home_focus latest query without todoId", () => {
    expect(
      validateDecisionAssistLatestQuery({ surface: "home_focus" }),
    ).toEqual({
      surface: "home_focus",
      todoId: undefined,
    });
  });

  it("still requires todoId for task_drawer latest query", () => {
    expect(() =>
      validateDecisionAssistLatestQuery({ surface: "task_drawer" }),
    ).toThrow(new ValidationError("todoId is required"));
  });

  it("rejects non-UUID todoId for persisted decision-assist surfaces", () => {
    expect(() =>
      validateDecisionAssistLatestQuery({
        surface: "task_drawer",
        todoId: "todo-1",
      }),
    ).toThrow(new ValidationError("Invalid ID format"));
  });

  it("accepts home_focus stub input with candidate alias payload", () => {
    const result = validateDecisionAssistStubInput({
      surface: "home_focus",
      topN: 3,
      candidates: [
        {
          id: "todo-1",
          title: "Review launch checklist",
          dueAt: "2026-03-15T12:00:00.000Z",
          priority: "high",
          projectName: "Launch",
          hasSubtasks: true,
          notesPresent: true,
        },
      ],
    });

    expect(result.surface).toBe("home_focus");
    expect(result.todoCandidates).toEqual([
      expect.objectContaining({
        id: "todo-1",
        title: "Review launch checklist",
        dueDate: "2026-03-15T12:00:00.000Z",
        priority: "high",
        projectName: "Launch",
        hasSubtasks: true,
        notesPresent: true,
      }),
    ]);
  });
});
