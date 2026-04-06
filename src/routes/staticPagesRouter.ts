/**
 * Static page routes — serves standalone HTML pages at product URLs.
 *
 * Extracted from app.ts to keep the factory focused on service wiring.
 *
 * NOTE: /auth, /feedback, /app are now served by React builds in app.ts.
 * Only legacy fallbacks remain here until the client/ folder is fully retired.
 */

import { Router, Request, Response } from "express";
import path from "path";

const CLIENT_PUBLIC = path.join(__dirname, "../../client/public");

export function createStaticPagesRouter(): Router {
  const router = Router();

  // Vanilla classic — SPA fallback at /app-classic and /app-classic/*
  const classicPage = path.join(CLIENT_PUBLIC, "app.html");
  router.get("/app-classic", (_req: Request, res: Response) =>
    res.sendFile(classicPage),
  );
  router.get("/app-classic/{*path}", (_req: Request, res: Response) =>
    res.sendFile(classicPage),
  );

  // Compatibility redirects — preserve old /app-react links (302 for rollback safety)
  router.get("/app-react", (_req: Request, res: Response) =>
    res.redirect(302, "/app"),
  );
  router.get("/app-react/{*path}", (req: Request, res: Response) => {
    const subPath = (req.params as Record<string, string>)["0"] || "";
    res.redirect(302, `/app/${subPath}`);
  });

  return router;
}
