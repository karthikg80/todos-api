/**
 * Route latency middleware — measures request duration and logs it
 * as structured JSON. Lightweight enough for baseline measurements;
 * can be promoted to a real metrics system later.
 *
 * Usage in app.ts:
 *   import { routeLatencyMiddleware } from './infra/metrics/routeLatency';
 *   app.use(routeLatencyMiddleware);
 */
import type { Request, Response, NextFunction } from "express";

export function routeLatencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round(durationNs / 1_000_000);

    // Only log non-static routes (skip /vendor, favicon, styles, etc.)
    const path = req.path;
    if (
      path.startsWith("/vendor/") ||
      path.endsWith(".js") ||
      path.endsWith(".css") ||
      path.endsWith(".svg") ||
      path.endsWith(".ico") ||
      path === "/"
    ) {
      return;
    }

    console.info(
      JSON.stringify({
        type: "route_latency",
        method: req.method,
        path: req.route?.path || path,
        statusCode: res.statusCode,
        durationMs,
        requestId: req.header("x-request-id") || undefined,
        timestamp: new Date().toISOString(),
      }),
    );
  });

  next();
}
