import {
  validateCreateFeedbackRequest,
  validateCreateTodo,
  validatePromoteFeedbackRequest,
  validateRetryAdminFeedbackRequest,
  validateUpdateTodo,
  validateId,
  validateReorderTodos,
  validateCreateSubtask,
  validateUpdateSubtask,
  validateCreateProject,
  validateUpdateProject,
  validateFindTodosQuery,
  validateReorderHeadings,
  ValidationError,
} from "./validation/validation";
import { validateFeedbackTriageOutput } from "./validation/feedbackTriageContracts";

describe("Validation", () => {
  describe("validateCreateTodo", () => {
    it("should validate a valid todo creation", () => {
      const result = validateCreateTodo({
        title: "Test Todo",
        description: "Test description",
      });

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBe("Test description");
    });

    it("should trim whitespace from title and description", () => {
      const result = validateCreateTodo({
        title: "  Test Todo  ",
        description: "  Test description  ",
      });

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBe("Test description");
    });

    it("should allow todo without description", () => {
      const result = validateCreateTodo({
        title: "Test Todo",
      });

      expect(result.title).toBe("Test Todo");
      expect(result.description).toBeUndefined();
    });

    it("should throw error for missing title", () => {
      expect(() => validateCreateTodo({})).toThrow(ValidationError);
      expect(() => validateCreateTodo({})).toThrow("Title is required");
    });

    it("should throw error for empty title", () => {
      expect(() => validateCreateTodo({ title: "   " })).toThrow(
        ValidationError,
      );
      expect(() => validateCreateTodo({ title: "   " })).toThrow(
        "Title cannot be empty",
      );
    });

    it("should throw error for non-string title", () => {
      expect(() => validateCreateTodo({ title: 123 })).toThrow(ValidationError);
      expect(() => validateCreateTodo({ title: 123 })).toThrow(
        "Title is required and must be a string",
      );
    });

    it("should throw error for title exceeding max length", () => {
      const longTitle = "a".repeat(201);
      expect(() => validateCreateTodo({ title: longTitle })).toThrow(
        ValidationError,
      );
      expect(() => validateCreateTodo({ title: longTitle })).toThrow(
        "Title cannot exceed 200 characters",
      );
    });

    it("should throw error for non-string description", () => {
      expect(() =>
        validateCreateTodo({ title: "Test", description: 123 }),
      ).toThrow(ValidationError);
      expect(() =>
        validateCreateTodo({ title: "Test", description: 123 }),
      ).toThrow("Description must be a string");
    });

    it("should throw error for description exceeding max length", () => {
      const longDescription = "a".repeat(1001);
      expect(() =>
        validateCreateTodo({ title: "Test", description: longDescription }),
      ).toThrow(ValidationError);
      expect(() =>
        validateCreateTodo({ title: "Test", description: longDescription }),
      ).toThrow("Description cannot exceed 1000 characters");
    });

    it("should throw error for non-object input", () => {
      expect(() => validateCreateTodo(null)).toThrow(ValidationError);
      expect(() => validateCreateTodo("string")).toThrow(ValidationError);
      expect(() => validateCreateTodo(123)).toThrow(ValidationError);
    });
  });

  describe("validateUpdateTodo", () => {
    it("should validate a valid update with all fields", () => {
      const result = validateUpdateTodo({
        title: "Updated Title",
        description: "Updated description",
        completed: true,
      });

      expect(result.title).toBe("Updated Title");
      expect(result.description).toBe("Updated description");
      expect(result.completed).toBe(true);
    });

    it("should validate update with only title", () => {
      const result = validateUpdateTodo({ title: "Updated Title" });
      expect(result.title).toBe("Updated Title");
      expect(result.description).toBeUndefined();
      expect(result.completed).toBeUndefined();
    });

    it("should validate update with only description", () => {
      const result = validateUpdateTodo({ description: "Updated description" });
      expect(result.description).toBe("Updated description");
      expect(result.title).toBeUndefined();
      expect(result.completed).toBeUndefined();
    });

    it("should validate update with only completed", () => {
      const result = validateUpdateTodo({ completed: true });
      expect(result.completed).toBe(true);
      expect(result.title).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it("should trim whitespace from title and description", () => {
      const result = validateUpdateTodo({
        title: "  Updated  ",
        description: "  Updated desc  ",
      });

      expect(result.title).toBe("Updated");
      expect(result.description).toBe("Updated desc");
    });

    it("should throw error for empty update object", () => {
      expect(() => validateUpdateTodo({})).toThrow(ValidationError);
      expect(() => validateUpdateTodo({})).toThrow(
        "At least one field must be provided",
      );
    });

    it("should throw error for empty title", () => {
      expect(() => validateUpdateTodo({ title: "   " })).toThrow(
        ValidationError,
      );
      expect(() => validateUpdateTodo({ title: "   " })).toThrow(
        "Title cannot be empty",
      );
    });

    it("should throw error for non-string title", () => {
      expect(() => validateUpdateTodo({ title: 123 })).toThrow(ValidationError);
      expect(() => validateUpdateTodo({ title: 123 })).toThrow(
        "Title must be a string",
      );
    });

    it("should throw error for non-boolean completed", () => {
      expect(() => validateUpdateTodo({ completed: "true" })).toThrow(
        ValidationError,
      );
      expect(() => validateUpdateTodo({ completed: "true" })).toThrow(
        "Completed must be a boolean",
      );
    });

    it("should throw error for non-object input", () => {
      expect(() => validateUpdateTodo(null)).toThrow(ValidationError);
      expect(() => validateUpdateTodo("string")).toThrow(ValidationError);
    });
  });

  describe("validateId", () => {
    it("should validate a valid UUID", () => {
      expect(() =>
        validateId("00000000-0000-1000-8000-000000000000"),
      ).not.toThrow();
    });

    it("should throw error for non-UUID string", () => {
      expect(() => validateId("valid-id")).toThrow(ValidationError);
      expect(() => validateId("valid-id")).toThrow("Invalid ID format");
    });

    it("should reject legacy non-UUID ID formats", () => {
      expect(() => validateId("ck6h4g2xk000001l7f57x8m6f")).toThrow(
        ValidationError,
      );
      expect(() => validateId("01ARZ3NDEKTSV4RRFFQ69G5FAV")).toThrow(
        ValidationError,
      );
    });

    it("should throw error for empty ID", () => {
      expect(() => validateId("")).toThrow(ValidationError);
      expect(() => validateId("")).toThrow("Invalid ID format");
    });

    it("should throw error for non-string ID", () => {
      expect(() => validateId(null as any)).toThrow(ValidationError);
      expect(() => validateId(123 as any)).toThrow(ValidationError);
    });
  });

  describe("validateReorderTodos", () => {
    it("should validate a valid reorder payload", () => {
      const items = validateReorderTodos([
        { id: "00000000-0000-1000-8000-000000000001", order: 0 },
        { id: "00000000-0000-1000-8000-000000000002", order: 1 },
      ]);
      expect(items).toHaveLength(2);
    });

    it("should throw when payload exceeds max item limit", () => {
      const payload = Array.from({ length: 501 }, (_, i) => ({
        id: `00000000-0000-1000-8000-${String(i + 1).padStart(12, "0")}`,
        order: i,
      }));
      expect(() => validateReorderTodos(payload)).toThrow(
        "Cannot reorder more than 500 todos at once",
      );
    });

    it("should throw for non-array input", () => {
      expect(() => validateReorderTodos("not-array")).toThrow(
        "Request body must be an array",
      );
      expect(() => validateReorderTodos({})).toThrow(
        "Request body must be an array",
      );
    });

    it("should throw for empty array", () => {
      expect(() => validateReorderTodos([])).toThrow(
        "At least one todo order item is required",
      );
    });

    it("should throw for duplicate ids", () => {
      const id = "00000000-0000-1000-8000-000000000001";
      expect(() =>
        validateReorderTodos([
          { id, order: 0 },
          { id, order: 1 },
        ]),
      ).toThrow("Duplicate todo IDs are not allowed");
    });

    it("should throw for item with non-object entry", () => {
      expect(() => validateReorderTodos([null])).toThrow(
        "Item at index 0 must be an object",
      );
    });

    it("should throw for item with invalid order", () => {
      expect(() =>
        validateReorderTodos([
          { id: "00000000-0000-1000-8000-000000000001", order: -1 },
        ]),
      ).toThrow("Item at index 0 has invalid order");
    });

    it("should accept optional headingId as string or null", () => {
      const items = validateReorderTodos([
        {
          id: "00000000-0000-1000-8000-000000000001",
          order: 0,
          headingId: "00000000-0000-1000-8000-000000000010",
        },
        {
          id: "00000000-0000-1000-8000-000000000002",
          order: 1,
          headingId: null,
        },
      ]);
      expect(items[0].headingId).toBe("00000000-0000-1000-8000-000000000010");
      expect(items[1].headingId).toBeNull();
    });

    it("should reject invalid headingId in reorder payload", () => {
      expect(() =>
        validateReorderTodos([
          {
            id: "00000000-0000-1000-8000-000000000001",
            order: 0,
            headingId: "",
          },
        ]),
      ).toThrow("Item at index 0 has invalid headingId");
    });
  });

  describe("validateReorderHeadings", () => {
    it("should validate a valid heading reorder payload", () => {
      const items = validateReorderHeadings([
        { id: "00000000-0000-1000-8000-000000000011", sortOrder: 0 },
        { id: "00000000-0000-1000-8000-000000000012", sortOrder: 1 },
      ]);
      expect(items).toHaveLength(2);
    });

    it("should reject duplicate heading IDs", () => {
      const id = "00000000-0000-1000-8000-000000000011";
      expect(() =>
        validateReorderHeadings([
          { id, sortOrder: 0 },
          { id, sortOrder: 1 },
        ]),
      ).toThrow("Duplicate heading IDs are not allowed");
    });

    it("should reject invalid sortOrder", () => {
      expect(() =>
        validateReorderHeadings([
          { id: "00000000-0000-1000-8000-000000000011", sortOrder: -1 },
        ]),
      ).toThrow("Item at index 0 has invalid sortOrder");
    });
  });

  describe("validateCreateSubtask", () => {
    it("should validate a valid subtask creation", () => {
      const result = validateCreateSubtask({ title: "Buy milk" });
      expect(result.title).toBe("Buy milk");
    });

    it("should trim whitespace from title", () => {
      const result = validateCreateSubtask({ title: "  Buy milk  " });
      expect(result.title).toBe("Buy milk");
    });

    it("should throw for missing title", () => {
      expect(() => validateCreateSubtask({})).toThrow(
        "Title is required and must be a string",
      );
    });

    it("should throw for non-string title", () => {
      expect(() => validateCreateSubtask({ title: 42 })).toThrow(
        "Title is required and must be a string",
      );
    });

    it("should throw for empty title", () => {
      expect(() => validateCreateSubtask({ title: "   " })).toThrow(
        "Title cannot be empty",
      );
    });

    it("should throw for title exceeding max length", () => {
      expect(() => validateCreateSubtask({ title: "a".repeat(201) })).toThrow(
        "Title cannot exceed 200 characters",
      );
    });

    it("should throw for non-object input", () => {
      expect(() => validateCreateSubtask(null)).toThrow(ValidationError);
      expect(() => validateCreateSubtask("string")).toThrow(ValidationError);
    });
  });

  describe("validateUpdateSubtask", () => {
    it("should validate update with title", () => {
      const result = validateUpdateSubtask({ title: "Updated" });
      expect(result.title).toBe("Updated");
    });

    it("should validate update with completed", () => {
      const result = validateUpdateSubtask({ completed: true });
      expect(result.completed).toBe(true);
    });

    it("should validate update with order", () => {
      const result = validateUpdateSubtask({ order: 3 });
      expect(result.order).toBe(3);
    });

    it("should throw for empty update", () => {
      expect(() => validateUpdateSubtask({})).toThrow(
        "At least one field must be provided for update",
      );
    });

    it("should throw for non-boolean completed", () => {
      expect(() => validateUpdateSubtask({ completed: "yes" })).toThrow(
        "Completed must be a boolean",
      );
    });

    it("should throw for negative order", () => {
      expect(() => validateUpdateSubtask({ order: -1 })).toThrow(
        "Order must be a non-negative integer",
      );
    });

    it("should throw for non-integer order", () => {
      expect(() => validateUpdateSubtask({ order: 1.5 })).toThrow(
        "Order must be a non-negative integer",
      );
    });

    it("should throw for non-object input", () => {
      expect(() => validateUpdateSubtask(null)).toThrow(ValidationError);
      expect(() => validateUpdateSubtask(42)).toThrow(ValidationError);
    });
  });

  describe("validateCreateProject", () => {
    it("should validate a valid project name", () => {
      const result = validateCreateProject({ name: "Work" });
      expect(result.name).toBe("Work");
    });

    it("should normalize slashes with spaces", () => {
      const result = validateCreateProject({ name: "Work/Tasks" });
      expect(result.name).toBe("Work / Tasks");
    });

    it("should throw for missing name", () => {
      expect(() => validateCreateProject({})).toThrow(
        "Project name must be a string",
      );
    });

    it("should throw for empty name", () => {
      expect(() => validateCreateProject({ name: "   " })).toThrow(
        "Project name cannot be empty",
      );
    });

    it("should throw for name exceeding max length", () => {
      expect(() => validateCreateProject({ name: "a".repeat(51) })).toThrow(
        "Project name cannot exceed 50 characters",
      );
    });

    it("should throw for non-object input", () => {
      expect(() => validateCreateProject(null)).toThrow(ValidationError);
      expect(() => validateCreateProject("string")).toThrow(ValidationError);
    });
  });

  describe("validateUpdateProject", () => {
    it("should validate a valid project name", () => {
      const result = validateUpdateProject({ name: "Personal" });
      expect(result.name).toBe("Personal");
    });

    it("should throw for empty update payload", () => {
      expect(() => validateUpdateProject({})).toThrow(
        "At least one field must be provided for update",
      );
    });

    it("should throw for non-object input", () => {
      expect(() => validateUpdateProject(null)).toThrow(ValidationError);
    });
  });

  describe("validateFindTodosQuery", () => {
    it("should return empty query for no params", () => {
      const result = validateFindTodosQuery({});
      expect(result).toEqual({});
    });

    it("should parse completed=true", () => {
      const result = validateFindTodosQuery({ completed: "true" });
      expect(result.completed).toBe(true);
    });

    it("should parse completed=false", () => {
      const result = validateFindTodosQuery({ completed: "false" });
      expect(result.completed).toBe(false);
    });

    it("should throw for invalid completed value", () => {
      expect(() => validateFindTodosQuery({ completed: "yes" })).toThrow(
        'completed must be "true" or "false"',
      );
    });

    it("should parse valid priority", () => {
      const result = validateFindTodosQuery({ priority: "HIGH" });
      expect(result.priority).toBe("high");
    });

    it("should parse urgent priority", () => {
      const result = validateFindTodosQuery({ priority: "urgent" });
      expect(result.priority).toBe("urgent");
    });

    it("should parse valid category", () => {
      const result = validateFindTodosQuery({ category: "Work" });
      expect(result.category).toBe("Work");
    });

    it("should throw for empty category", () => {
      expect(() => validateFindTodosQuery({ category: "   " })).toThrow(
        "category cannot be empty",
      );
    });

    it("should parse valid sortBy", () => {
      const result = validateFindTodosQuery({ sortBy: "order" });
      expect(result.sortBy).toBe("order");
    });

    it("should throw for invalid sortBy", () => {
      expect(() => validateFindTodosQuery({ sortBy: "invalid" })).toThrow(
        "sortBy must be one of:",
      );
    });

    it("should parse sortOrder", () => {
      const result = validateFindTodosQuery({ sortOrder: "DESC" });
      expect(result.sortOrder).toBe("desc");
    });

    it("should throw for invalid sortOrder", () => {
      expect(() => validateFindTodosQuery({ sortOrder: "random" })).toThrow(
        "sortOrder must be asc or desc",
      );
    });

    it("should parse page and limit", () => {
      const result = validateFindTodosQuery({ page: "2", limit: "10" });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it("should throw for limit exceeding max", () => {
      expect(() => validateFindTodosQuery({ limit: "101" })).toThrow(
        "limit cannot exceed 100",
      );
    });

    it("should throw for non-numeric page", () => {
      expect(() => validateFindTodosQuery({ page: "abc" })).toThrow(
        "page must be a positive integer",
      );
    });

    it("should throw for non-object input", () => {
      expect(() => validateFindTodosQuery(null)).toThrow(ValidationError);
    });
  });

  describe("feedback validation", () => {
    it("validates structured feedback submission input", () => {
      const result = validateCreateFeedbackRequest({
        type: "bug",
        title: " Task drawer crashes ",
        body: " What happened?\nCrash ",
        screenshotUrl: "https://example.com/file.png",
      });

      expect(result).toMatchObject({
        type: "bug",
        title: "Task drawer crashes",
        body: "What happened?\nCrash",
        screenshotUrl: "https://example.com/file.png",
      });
    });

    it("rejects invalid retry actions", () => {
      expect(() =>
        validateRetryAdminFeedbackRequest({ action: "ship-it" }),
      ).toThrow('action must be "triage", "duplicate_check", or "promotion"');
    });

    it("validates promote request booleans", () => {
      expect(
        validatePromoteFeedbackRequest({ ignoreDuplicateSuggestion: true }),
      ).toEqual({
        ignoreDuplicateSuggestion: true,
      });
      expect(() =>
        validatePromoteFeedbackRequest({ ignoreDuplicateSuggestion: "yes" }),
      ).toThrow("ignoreDuplicateSuggestion must be a boolean");
    });

    it("validates triage output contract strictly", () => {
      expect(
        validateFeedbackTriageOutput({
          classification: "bug",
          triageConfidence: 0.9231,
          normalizedTitle: "Task drawer crashes on save",
          normalizedBody: "Saving from the drawer crashes the session.",
          impactSummary: "Users lose edits.",
          reproSteps: ["Open drawer", "Edit notes", "Press save"],
          expectedBehavior: "Save succeeds.",
          actualBehavior: "Drawer crashes.",
          proposedOutcome: null,
          labels: ["bug", "ui"],
          missingInfo: [],
        }),
      ).toMatchObject({
        classification: "bug",
        triageConfidence: 0.923,
      });

      expect(() =>
        validateFeedbackTriageOutput({
          classification: "bug",
          triageConfidence: 1.5,
          normalizedTitle: "x",
          normalizedBody: "y",
          labels: [],
          missingInfo: [],
        }),
      ).toThrow("triageConfidence must be between 0 and 1");
    });
  });
});
