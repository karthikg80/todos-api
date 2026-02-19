import {
  applyTodoBoundSuggestion,
  applyTodayPlanSuggestions,
  ApplyTodoBoundResult,
  ApplyTodayPlanResult,
} from "./aiApplyService";
import { ITodoService } from "./interfaces/ITodoService";
import { IProjectService } from "./interfaces/IProjectService";
import {
  NormalizedTodoBoundSuggestion,
  NormalizedTodayPlanSuggestion,
} from "./aiNormalizationService";

// ── Helpers ──

const USER_ID = "user-1";
const TODO_ID = "todo-1";

function makeTodo(overrides: Record<string, unknown> = {}) {
  return {
    id: TODO_ID,
    userId: USER_ID,
    title: "Buy groceries",
    completed: false,
    priority: "medium" as const,
    notes: undefined as string | undefined,
    category: undefined as string | undefined,
    dueDate: undefined as Date | undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    ...overrides,
  };
}

function buildMockTodoService(
  overrides: Partial<ITodoService> = {},
): ITodoService {
  const baseTodo = makeTodo();
  return {
    findAll: jest.fn().mockResolvedValue([baseTodo]),
    findById: jest.fn().mockResolvedValue(baseTodo),
    create: jest.fn().mockResolvedValue(baseTodo),
    update: jest.fn().mockImplementation(async (_userId, _id, dto) => ({
      ...baseTodo,
      ...dto,
    })),
    delete: jest.fn().mockResolvedValue(true),
    reorder: jest.fn().mockResolvedValue([baseTodo]),
    createSubtask: jest.fn().mockResolvedValue({
      id: "sub-1",
      title: "Subtask",
      completed: false,
      order: 1,
      todoId: baseTodo.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateSubtask: jest.fn().mockResolvedValue(null),
    deleteSubtask: jest.fn().mockResolvedValue(true),
    findSubtasks: jest.fn().mockResolvedValue([]),
    clear: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildMockProjectService(
  overrides: Partial<IProjectService> = {},
): IProjectService {
  return {
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  };
}

function makeSuggestion(
  type: string,
  payload: Record<string, unknown>,
  overrides: Partial<NormalizedTodoBoundSuggestion> = {},
): NormalizedTodoBoundSuggestion {
  return {
    type: type as NormalizedTodoBoundSuggestion["type"],
    confidence: 0.85,
    rationale: "Test rationale",
    payload,
    suggestionId: "sug-1",
    requiresConfirmation: false,
    ...overrides,
  };
}

// ── applyTodoBoundSuggestion ──

describe("applyTodoBoundSuggestion", () => {
  it("applies rewrite_title and returns updated todo", async () => {
    const todoService = buildMockTodoService();
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("rewrite_title", {
        title: "Buy organic groceries",
      }),
      todoService,
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedTodo.title).toBe("Buy organic groceries");
    }
    expect(todoService.update).toHaveBeenCalledWith(
      USER_ID,
      TODO_ID,
      expect.objectContaining({ title: "Buy organic groceries" }),
    );
  });

  it("rejects empty rewrite title", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("rewrite_title", { title: "   " }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("Invalid rewrite title");
    }
  });

  it("applies set_due_date with valid future date", async () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_due_date", { dueDateISO: futureDate }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
  });

  it("rejects past due date without confirmation", async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_due_date", { dueDateISO: pastDate }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "Past due dates require explicit confirmation",
      );
    }
  });

  it("accepts past due date with confirmation", async () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_due_date", { dueDateISO: pastDate }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
      confirmed: true,
    });

    expect(result.ok).toBe(true);
  });

  it("applies set_priority for valid priority", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_priority", { priority: "low" }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
  });

  it("requires confirmation for high priority", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_priority", { priority: "high" }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(
        "High priority changes require explicit confirmation",
      );
    }
  });

  it("applies set_category with valid category", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_category", { category: "Errands" }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
  });

  it("resolves projectId via project service for set_project", async () => {
    const projectService = buildMockProjectService({
      findAll: jest.fn().mockResolvedValue([
        {
          id: "proj-1",
          name: "Work",
          userId: USER_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    });
    const todoService = buildMockTodoService();

    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("set_project", { projectId: "proj-1" }),
      todoService,
      projectService,
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
    expect(todoService.update).toHaveBeenCalledWith(
      USER_ID,
      TODO_ID,
      expect.objectContaining({ category: "Work" }),
    );
  });

  it("applies split_subtasks with valid subtasks", async () => {
    const todoService = buildMockTodoService();
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("split_subtasks", {
        subtasks: [
          { title: "Sub A", order: 1 },
          { title: "Sub B", order: 2 },
        ],
      }),
      todoService,
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
    expect(todoService.createSubtask).toHaveBeenCalledTimes(2);
  });

  it("rejects split_subtasks with more than 5", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("split_subtasks", {
        subtasks: [
          { title: "A", order: 1 },
          { title: "B", order: 2 },
          { title: "C", order: 3 },
          { title: "D", order: 4 },
          { title: "E", order: 5 },
          { title: "F", order: 6 },
        ],
      }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("split_subtasks requires 1-5 subtasks");
    }
  });

  it("applies propose_next_action to notes", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("propose_next_action", {
        text: "Check prices online",
      }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(true);
  });

  it("rejects ask_clarification for apply", async () => {
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("ask_clarification", { question: "When?" }),
      todoService: buildMockTodoService(),
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not supported for apply");
    }
  });

  it("returns 404 when todo is not found during update", async () => {
    const todoService = buildMockTodoService({
      update: jest.fn().mockResolvedValue(null),
    });
    const result = await applyTodoBoundSuggestion({
      selected: makeSuggestion("rewrite_title", { title: "Valid title" }),
      todoService,
      userId: USER_ID,
      inputTodoId: TODO_ID,
      todo: makeTodo(),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(404);
    }
  });
});

// ── applyTodayPlanSuggestions ──

describe("applyTodayPlanSuggestions", () => {
  it("applies multiple suggestions across different todos", async () => {
    const todoA = makeTodo({ id: "todo-a" });
    const todoB = makeTodo({ id: "todo-b" });

    const todoService = buildMockTodoService({
      findById: jest
        .fn()
        .mockImplementation(async (_uid: string, id: string) => {
          if (id === "todo-a") return todoA;
          if (id === "todo-b") return todoB;
          return null;
        }),
      update: jest
        .fn()
        .mockImplementation(async (_uid: string, id: string, dto: unknown) => ({
          ...(id === "todo-a" ? todoA : todoB),
          ...(dto as Record<string, unknown>),
        })),
    });

    const suggestions: NormalizedTodayPlanSuggestion[] = [
      {
        type: "set_priority",
        confidence: 0.8,
        rationale: "Critical task",
        payload: { todoId: "todo-a", priority: "medium" },
        suggestionId: "sug-1",
        requiresConfirmation: false,
      },
      {
        type: "set_due_date",
        confidence: 0.7,
        rationale: "Needs deadline",
        payload: {
          todoId: "todo-b",
          dueDateISO: new Date(Date.now() + 86_400_000).toISOString(),
        },
        suggestionId: "sug-2",
        requiresConfirmation: false,
      },
    ];

    const result = await applyTodayPlanSuggestions({
      applicableSuggestions: suggestions,
      todoService,
      userId: USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedTodoIds).toHaveLength(2);
      expect(result.appliedTodoIds).toContain("todo-a");
      expect(result.appliedTodoIds).toContain("todo-b");
    }
  });

  it("skips suggestions with empty todoId", async () => {
    const todoService = buildMockTodoService();
    const suggestions: NormalizedTodayPlanSuggestion[] = [
      {
        type: "set_priority",
        confidence: 0.8,
        rationale: "Test",
        payload: { todoId: "", priority: "low" },
        suggestionId: "sug-1",
        requiresConfirmation: false,
      },
    ];

    const result = await applyTodayPlanSuggestions({
      applicableSuggestions: suggestions,
      todoService,
      userId: USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.appliedTodoIds).toHaveLength(0);
    }
  });

  it("requires confirmation when suggestion has requiresConfirmation", async () => {
    const suggestions: NormalizedTodayPlanSuggestion[] = [
      {
        type: "set_priority",
        confidence: 0.8,
        rationale: "Test",
        payload: { todoId: TODO_ID, priority: "low" },
        suggestionId: "sug-1",
        requiresConfirmation: true,
      },
    ];

    const result = await applyTodayPlanSuggestions({
      applicableSuggestions: suggestions,
      todoService: buildMockTodoService(),
      userId: USER_ID,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Confirmation is required");
    }
  });

  it("returns empty result when no suggestions", async () => {
    const result = await applyTodayPlanSuggestions({
      applicableSuggestions: [],
      todoService: buildMockTodoService(),
      userId: USER_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.updatedTodos).toHaveLength(0);
      expect(result.appliedTodoIds).toHaveLength(0);
    }
  });
});
