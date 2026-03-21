import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { HttpError, hasPrismaCode } from "../errorHandling";
import { FeedbackService } from "../services/feedbackService";
import {
  DuplicatePromotionConflictError,
  FeedbackDuplicateService,
} from "../services/feedbackDuplicateService";
import { FeedbackTriageService } from "../services/feedbackTriageService";
import {
  validateListAdminFeedbackRequestsQuery,
  validateUpdateAdminFeedbackRequest,
} from "../validation/validation";

interface AdminRouterDeps {
  authService?: AuthService;
  feedbackService?: FeedbackService;
  feedbackTriageService?: FeedbackTriageService;
  feedbackDuplicateService?: FeedbackDuplicateService;
}

export function createAdminRouter({
  authService,
  feedbackService,
  feedbackTriageService,
  feedbackDuplicateService,
}: AdminRouterDeps): Router {
  const router = Router();

  router.get(
    "/users",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const rawLimit = req.query.limit as string | undefined;
        const rawOffset = req.query.offset as string | undefined;

        const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
        const offset = rawOffset ? Number.parseInt(rawOffset, 10) : 0;

        if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
          return res
            .status(400)
            .json({ error: "limit must be an integer between 1 and 200" });
        }
        if (!Number.isInteger(offset) || offset < 0) {
          return res
            .status(400)
            .json({ error: "offset must be a non-negative integer" });
        }

        const users = await authService.getAllUsers({ limit, offset });
        res.json(users);
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/users/:id/role",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const id = req.params.id as string;
        const role = req.body.role as string;

        if (!role || !["user", "admin"].includes(role)) {
          return res
            .status(400)
            .json({ error: 'Invalid role. Must be "user" or "admin"' });
        }

        await authService.updateUserRole(id, role as "user" | "admin");
        res.json({ message: "User role updated successfully" });
      } catch (error: unknown) {
        if (error instanceof Error && error.message === "Invalid role") {
          return next(new HttpError(400, error.message));
        }
        if (hasPrismaCode(error, ["P2025"])) {
          return next(new HttpError(404, "User not found"));
        }
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid user ID format"));
        }
        return next(error);
      }
    },
  );

  router.delete(
    "/users/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const id = req.params.id as string;

        if (id === req.user?.userId) {
          return res
            .status(400)
            .json({ error: "Cannot delete your own account" });
        }

        await authService.deleteUser(id);
        res.json({ message: "User deleted successfully" });
      } catch (error) {
        if (hasPrismaCode(error, ["P2025"])) {
          return next(new HttpError(404, "User not found"));
        }
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid user ID format"));
        }
        return next(error);
      }
    },
  );

  router.get(
    "/feedback",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!feedbackService) {
        return res
          .status(501)
          .json({ error: "Feedback persistence not configured" });
      }

      try {
        const query = validateListAdminFeedbackRequestsQuery(req.query);
        const feedbackRequests = await feedbackService.listForAdmin(query);
        res.json(feedbackRequests);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/feedback/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!feedbackService) {
        return res
          .status(501)
          .json({ error: "Feedback persistence not configured" });
      }

      try {
        const feedbackId = String(req.params.id);
        const feedbackRequest = await feedbackService.getForAdmin(feedbackId);
        if (!feedbackRequest) {
          return next(new HttpError(404, "Feedback request not found"));
        }

        res.json(feedbackRequest);
      } catch (error) {
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid feedback request ID format"));
        }
        next(error);
      }
    },
  );

  router.patch(
    "/feedback/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!feedbackService) {
        return res
          .status(501)
          .json({ error: "Feedback persistence not configured" });
      }

      try {
        const reviewerUserId = req.user?.userId;
        const feedbackId = String(req.params.id);
        if (!reviewerUserId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const dto = validateUpdateAdminFeedbackRequest(req.body);
        if (
          dto.status === "promoted" &&
          !dto.ignoreDuplicateSuggestion &&
          !dto.duplicateOfFeedbackId &&
          !dto.duplicateOfGithubIssueNumber
        ) {
          if (!feedbackDuplicateService) {
            return res
              .status(501)
              .json({ error: "Feedback duplicate detection not configured" });
          }

          await feedbackDuplicateService.assertPromotionIsSafe(feedbackId);
        }

        const feedbackRequest = await feedbackService.updateReviewStatus(
          feedbackId,
          reviewerUserId,
          dto,
        );
        res.json(feedbackRequest);
      } catch (error) {
        if (error instanceof DuplicatePromotionConflictError) {
          const feedbackRequest = await feedbackService.getForAdmin(
            String(req.params.id),
          );
          return res.status(409).json({
            error: error.message,
            duplicateDetection: error.assessment,
            feedbackRequest,
          });
        }
        if (hasPrismaCode(error, ["P2025"])) {
          return next(new HttpError(404, "Feedback request not found"));
        }
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid feedback request ID format"));
        }
        next(error);
      }
    },
  );

  router.post(
    "/feedback/:id/duplicate-check",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!feedbackService || !feedbackDuplicateService) {
        return res
          .status(501)
          .json({ error: "Feedback duplicate detection not configured" });
      }

      try {
        const feedbackId = String(req.params.id);
        await feedbackDuplicateService.detectAndPersist(feedbackId);
        const feedbackRequest = await feedbackService.getForAdmin(feedbackId);
        if (!feedbackRequest) {
          return next(new HttpError(404, "Feedback request not found"));
        }
        res.json(feedbackRequest);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Feedback request not found"
        ) {
          return next(new HttpError(404, error.message));
        }
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid feedback request ID format"));
        }
        next(error);
      }
    },
  );

  router.post(
    "/feedback/:id/triage",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!feedbackService || !feedbackTriageService) {
        return res
          .status(501)
          .json({ error: "Feedback triage not configured" });
      }

      try {
        const feedbackId = String(req.params.id);
        await feedbackTriageService.triageFeedback(feedbackId);
        const feedbackRequest = await feedbackService.getForAdmin(feedbackId);
        if (!feedbackRequest) {
          return next(new HttpError(404, "Feedback request not found"));
        }
        res.json(feedbackRequest);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Feedback request not found"
        ) {
          return next(new HttpError(404, error.message));
        }
        if (hasPrismaCode(error, ["P2023"])) {
          return next(new HttpError(400, "Invalid feedback request ID format"));
        }
        next(error);
      }
    },
  );

  return router;
}
