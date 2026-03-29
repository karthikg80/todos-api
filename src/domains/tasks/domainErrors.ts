/**
 * Domain error types for structured error handling.
 *
 * These errors carry semantic meaning and HTTP status codes.
 * The centralized error handler middleware maps them to responses,
 * so route handlers don't need individual try-catch blocks.
 */

export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(
      404,
      id ? `${entity} not found: ${id}` : `${entity} not found`,
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}

export class QuotaExceededError extends AppError {
  readonly usage?: Record<string, unknown>;

  constructor(message: string, usage?: Record<string, unknown>) {
    super(429, message);
    this.usage = usage;
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, message);
  }
}

export class LifecycleTransitionError extends ValidationError {
  constructor(from: string, to: string) {
    super(`Invalid lifecycle transition from '${from}' to '${to}'`);
  }
}

export class InvalidRelationError extends ValidationError {
  constructor(relation: string, message?: string) {
    super(message ?? `Invalid ${relation}`);
  }
}
