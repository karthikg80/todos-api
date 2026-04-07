/**
 * Static page routes — serves standalone HTML pages at product URLs.
 *
 * NOTE: All product-facing pages (/app, /auth, /feedback) are now served
 * by React builds in app.ts. This router only handles compatibility redirects.
 */

import { Router, Request, Response } from "express";

export function createStaticPagesRouter(): Router {
  const router = Router();

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
