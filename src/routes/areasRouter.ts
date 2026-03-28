import { Router, Request, Response, NextFunction } from "express";
import { AreaService, DuplicateAreaNameError } from "../services/areaService";

interface AreasRouterDeps {
  areaService?: AreaService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

export function createAreasRouter({
  areaService,
  resolveUserId,
}: AreasRouterDeps): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!areaService)
        return res.status(501).json({ error: "Areas not configured" });
      const userId = resolveUserId(req, res);
      if (!userId) return;
      const archived = req.query.archived === "true" ? true : undefined;
      const areas = await areaService.findAll(userId, { archived });
      res.json(areas);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!areaService)
        return res.status(501).json({ error: "Areas not configured" });
      const userId = resolveUserId(req, res);
      if (!userId) return;
      const { name, description } = req.body;
      if (!name || typeof name !== "string" || !name.trim())
        return res.status(400).json({ error: "name is required" });
      if (name.length > 100)
        return res.status(400).json({ error: "name max length is 100" });
      const area = await areaService.create(userId, {
        name: name.trim(),
        description: description ?? null,
      });
      res.status(201).json(area);
    } catch (error) {
      if (error instanceof DuplicateAreaNameError)
        return res.status(409).json({ error: error.message });
      next(error);
    }
  });

  router.get(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!areaService)
          return res.status(501).json({ error: "Areas not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const area = await areaService.findById(userId, String(req.params.id));
        if (!area) return res.status(404).json({ error: "Area not found" });
        res.json(area);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!areaService)
          return res.status(501).json({ error: "Areas not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const area = await areaService.update(
          userId,
          String(req.params.id),
          req.body,
        );
        if (!area) return res.status(404).json({ error: "Area not found" });
        res.json(area);
      } catch (error) {
        if (error instanceof DuplicateAreaNameError)
          return res.status(409).json({ error: error.message });
        next(error);
      }
    },
  );

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!areaService)
          return res.status(501).json({ error: "Areas not configured" });
        const userId = resolveUserId(req, res);
        if (!userId) return;
        const deleted = await areaService.delete(userId, String(req.params.id));
        if (!deleted) return res.status(404).json({ error: "Area not found" });
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
