/**
 * Static page routes — serves standalone HTML pages at product URLs.
 *
 * Extracted from app.ts to keep the factory focused on service wiring.
 */

import { Router, Request, Response } from "express";
import path from "path";

const CLIENT_PUBLIC = path.join(__dirname, "../../client/public");

const PAGE_ROUTES: Array<{ path: string; file: string }> = [
  { path: "/auth", file: "auth.html" },
  { path: "/app", file: "app.html" },
  { path: "/feedback", file: "feedback.html" },
  { path: "/feedback/new", file: "feedback-new.html" },
];

export function createStaticPagesRouter(): Router {
  const router = Router();

  for (const route of PAGE_ROUTES) {
    const filePath = path.join(CLIENT_PUBLIC, route.file);
    router.get(route.path, (_req: Request, res: Response) =>
      res.sendFile(filePath),
    );
  }

  // SPA catch-all for /app/* sub-routes
  const appPage = path.join(CLIENT_PUBLIC, "app.html");
  router.get("/app/{*path}", (_req: Request, res: Response) =>
    res.sendFile(appPage),
  );

  return router;
}
