import { Router, Request, Response } from "express";
import { ActivityEventService } from "../services/activityEventService";

interface EventsRouterDeps {
  activityEventService?: ActivityEventService;
  resolveUserId: (req: Request, res: Response) => string | null;
}

export function createEventsRouter({
  activityEventService,
  resolveUserId,
}: EventsRouterDeps): Router {
  const router = Router();

  /**
   * POST /events/batch
   * Accepts an array of client-side events to record.
   */
  router.post("/batch", async (req: Request, res: Response) => {
    const userId = resolveUserId(req, res);
    if (!userId) return;

    if (!activityEventService) {
      res.status(503).json({ error: "Activity events not configured" });
      return;
    }

    const { events } = req.body;

    if (!Array.isArray(events)) {
      res
        .status(400)
        .json({ error: "Request body must contain an events array" });
      return;
    }

    if (events.length === 0) {
      res.json({ recorded: 0 });
      return;
    }

    if (events.length > 50) {
      res.status(400).json({ error: "Maximum 50 events per batch" });
      return;
    }

    try {
      const count = await activityEventService.batchCreate(userId, events);
      res.json({ recorded: count });
    } catch (err) {
      console.error("Failed to batch-create activity events:", err);
      res.status(500).json({ error: "Failed to record events" });
    }
  });

  return router;
}
