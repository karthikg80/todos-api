/**
 * Structured JSON logger with correlation ID support.
 *
 * Usage:
 *   import { createLogger } from '../infra/logging/logger';
 *   const log = createLogger('myService');
 *   log.info('operation completed', { userId, duration: 42 });
 *   log.error('operation failed', { error: err.message, requestId });
 *
 * In request handlers, pass requestId for correlation:
 *   const log = createLogger('todosRouter', { requestId: req.headers['x-request-id'] });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  service: string;
  message: string;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LoggerContext {
  requestId?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  child(context: LoggerContext): Logger;
}

function formatEntry(
  level: LogLevel,
  service: string,
  message: string,
  context: LoggerContext,
  data?: Record<string, unknown>,
): string {
  const entry: LogEntry = {
    level,
    service,
    message,
    timestamp: new Date().toISOString(),
    ...context,
    ...data,
  };
  return JSON.stringify(entry);
}

export function createLogger(
  service: string,
  context: LoggerContext = {},
): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>) {
      if (process.env.LOG_LEVEL === "debug") {
        console.debug(formatEntry("debug", service, message, context, data));
      }
    },
    info(message: string, data?: Record<string, unknown>) {
      console.info(formatEntry("info", service, message, context, data));
    },
    warn(message: string, data?: Record<string, unknown>) {
      console.warn(formatEntry("warn", service, message, context, data));
    },
    error(message: string, data?: Record<string, unknown>) {
      console.error(formatEntry("error", service, message, context, data));
    },
    child(childContext: LoggerContext): Logger {
      return createLogger(service, { ...context, ...childContext });
    },
  };
}
