/**
 * Agent run queue — in-process async execution for on-demand agent runs.
 *
 * This is a lightweight in-process queue that runs agent actions outside
 * the HTTP request cycle. It can be replaced with BullMQ when Redis is
 * available (per ADR-005, Option A).
 *
 * For now, this uses setImmediate() to defer execution after the HTTP
 * response is sent, which is sufficient to unblock the Express event loop
 * for the 202 response.
 */

import type { AgentExecutor } from "../../../agent/agentExecutor";
import type { AgentJobRunService } from "../../../services/agentJobRunService";
import { createLogger } from "../../../infra/logging/logger";

const log = createLogger("agentRunQueue");

export interface EnqueuedRun {
  runId: string;
  userId: string;
  action: string;
  params: Record<string, unknown>;
  requestId: string;
  actor: string;
}

export function createAgentRunQueue(deps: {
  agentExecutor: AgentExecutor;
  jobRunService: AgentJobRunService;
}) {
  const { agentExecutor, jobRunService } = deps;

  /**
   * Enqueue an agent action for async execution.
   * The action runs after the current event loop tick, allowing the
   * HTTP handler to return 202 immediately.
   */
  function enqueue(run: EnqueuedRun): void {
    setImmediate(async () => {
      const startTime = Date.now();
      log.info("agent run started", {
        runId: run.runId,
        action: run.action,
        userId: run.userId,
        requestId: run.requestId,
      });

      try {
        const result = await agentExecutor.execute(
          run.action as never,
          run.params,
          {
            userId: run.userId,
            requestId: run.requestId,
            actor: run.actor,
            surface: "agent" as const,
          },
        );

        const durationMs = Date.now() - startTime;

        if (result.status >= 200 && result.status < 300) {
          await jobRunService.completeRun(run.userId, run.action, run.runId, {
            result: result.body,
            durationMs,
          });
          log.info("agent run completed", {
            runId: run.runId,
            action: run.action,
            durationMs,
          });
        } else {
          const errorMessage =
            typeof result.body === "object" && result.body !== null
              ? (result.body as Record<string, unknown>).error ||
                (result.body as Record<string, unknown>).message ||
                `HTTP ${result.status}`
              : `HTTP ${result.status}`;
          await jobRunService.failRun(
            run.userId,
            run.action,
            run.runId,
            String(errorMessage),
          );
          log.error("agent run failed", {
            runId: run.runId,
            action: run.action,
            status: result.status,
            durationMs,
          });
        }
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await jobRunService
          .failRun(run.userId, run.action, run.runId, errorMessage)
          .catch((e) =>
            log.error("failed to record run failure", { error: String(e) }),
          );
        log.error("agent run exception", {
          runId: run.runId,
          action: run.action,
          error: errorMessage,
          durationMs,
        });
      }
    });
  }

  return { enqueue };
}
