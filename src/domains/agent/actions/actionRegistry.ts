/**
 * Action registry — maps agent action names to domain-scoped handlers.
 *
 * This registry enables incremental decomposition of agentExecutor.ts.
 * Actions can be registered here and the executor will delegate to them
 * instead of handling them inline.
 *
 * Usage:
 *   registerAction('list_tasks', async (params, context) => { ... });
 *   const handler = getActionHandler('list_tasks');
 *   if (handler) { return await handler(params, context); }
 */

export interface ActionContext {
  userId: string;
  requestId: string;
  actor: string;
  surface: "agent" | "mcp";
  idempotencyKey?: string;
}

export interface ActionResult {
  status: number;
  body: unknown;
}

export type ActionHandler = (
  params: Record<string, unknown>,
  context: ActionContext,
) => Promise<ActionResult>;

const registry = new Map<string, ActionHandler>();

/**
 * Register a handler for an agent action.
 */
export function registerAction(action: string, handler: ActionHandler): void {
  registry.set(action, handler);
}

/**
 * Get the registered handler for an action, or undefined if not registered.
 */
export function getActionHandler(action: string): ActionHandler | undefined {
  return registry.get(action);
}

/**
 * Check if an action has a registered handler.
 */
export function hasActionHandler(action: string): boolean {
  return registry.has(action);
}

/**
 * Get all registered action names.
 */
export function getRegisteredActions(): string[] {
  return Array.from(registry.keys());
}
