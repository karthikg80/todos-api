/**
 * Shared error class for agent action handlers.
 * Throw this from extracted handlers to produce the canonical
 * error envelope with status, code, and optional hint/details.
 *
 * The executor's error-mapping logic (`toAgentError`) recognises
 * this class and preserves the custom fields in the response.
 */
export class AgentExecutionError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly hint?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AgentExecutionError";
  }
}
