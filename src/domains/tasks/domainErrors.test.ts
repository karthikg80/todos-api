import {
  AppError,
  NotFoundError,
  ValidationError,
  ConflictError,
  QuotaExceededError,
  ForbiddenError,
  LifecycleTransitionError,
  InvalidRelationError,
} from "./domainErrors";

describe("domain errors", () => {
  it("NotFoundError has status 404", () => {
    const err = new NotFoundError("Todo", "abc-123");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Todo not found: abc-123");
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it("NotFoundError works without id", () => {
    const err = new NotFoundError("Project");
    expect(err.message).toBe("Project not found");
  });

  it("ValidationError has status 400", () => {
    const err = new ValidationError("bad input");
    expect(err.status).toBe(400);
  });

  it("ConflictError has status 409", () => {
    const err = new ConflictError("already exists");
    expect(err.status).toBe(409);
  });

  it("QuotaExceededError has status 429 and optional usage", () => {
    const err = new QuotaExceededError("limit reached", { used: 50, max: 50 });
    expect(err.status).toBe(429);
    expect(err.usage).toEqual({ used: 50, max: 50 });
  });

  it("ForbiddenError has status 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.message).toBe("Forbidden");
  });

  it("LifecycleTransitionError has status 400 with descriptive message", () => {
    const err = new LifecycleTransitionError("done", "in_progress");
    expect(err.status).toBe(400);
    expect(err.message).toContain("done");
    expect(err.message).toContain("in_progress");
    expect(err).toBeInstanceOf(ValidationError);
  });

  it("InvalidRelationError has status 400", () => {
    const err = new InvalidRelationError(
      "heading",
      "Heading does not belong to project",
    );
    expect(err.status).toBe(400);
    expect(err).toBeInstanceOf(ValidationError);
  });
});
