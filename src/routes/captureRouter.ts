import { Router, Request, Response, NextFunction } from "express";
import { CaptureService } from "../services/captureService";

export function createCaptureRouter(captureService: CaptureService): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { text, source, capturedAt } = req.body;
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "text is required" });
        return;
      }
      const item = await captureService.create(
        userId,
        text.trim(),
        source,
        capturedAt ? new Date(capturedAt) : undefined,
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const lifecycleRaw = req.query.lifecycle;
      const lifecycle =
        typeof lifecycleRaw === "string" ? lifecycleRaw : undefined;
      const items = await captureService.findAll(
        userId,
        lifecycle as "new" | "triaged" | "discarded" | undefined,
      );
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const id = req.params.id as string;
        const item = await captureService.findById(userId, id);
        if (!item) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.json(item);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.userId;
        if (!userId) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        const { lifecycle, triageResult } = req.body as {
          lifecycle: unknown;
          triageResult: unknown;
        };
        const validLifecycles = ["new", "triaged", "discarded"] as const;
        if (
          !lifecycle ||
          typeof lifecycle !== "string" ||
          !validLifecycles.includes(
            lifecycle as "new" | "triaged" | "discarded",
          )
        ) {
          res.status(400).json({
            error: "lifecycle must be new, triaged, or discarded",
          });
          return;
        }
        const id = req.params.id as string;
        const item = await captureService.updateLifecycle(
          userId,
          id,
          lifecycle as "new" | "triaged" | "discarded",
          triageResult,
        );
        if (!item) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.json(item);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
