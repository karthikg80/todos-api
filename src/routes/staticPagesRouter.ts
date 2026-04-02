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

  // React SPA — primary app at /app and /app/*
  const reactIndex = path.join(__dirname, "../../client-react/dist/index.html");
  router.get("/app", (_req: Request, res: Response) =>
    res.sendFile(reactIndex),
  );
  router.get("/app/{*path}", (_req: Request, res: Response) =>
    res.sendFile(reactIndex),
  );

  // Vanilla SPA — classic fallback at /app-classic and /app-classic/*
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
