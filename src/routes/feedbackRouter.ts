import { Router, Request, Response, NextFunction } from "express";
import { FeedbackService } from "../services/feedbackService";
import { validateCreateFeedbackRequest } from "../validation/validation";

interface FeedbackRouterDeps {
  feedbackService: FeedbackService;
}

export function createFeedbackRouter({
  feedbackService,
}: FeedbackRouterDeps): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const items = await feedbackService.listForUser(userId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const dto = validateCreateFeedbackRequest(req.body);
      const feedbackRequest = await feedbackService.create(userId, dto);
      res.status(201).json(feedbackRequest);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
