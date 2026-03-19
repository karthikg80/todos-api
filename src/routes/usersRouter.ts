import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "../services/authService";
import { isValidEmail } from "../validation/authValidation";

interface UsersRouterDeps {
  authService?: AuthService;
}

export function createUsersRouter({ authService }: UsersRouterDeps): Router {
  const router = Router();

  router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
    if (!authService) {
      return res.status(501).json({ error: "Authentication not configured" });
    }

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await authService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  router.put("/me", async (req: Request, res: Response, next: NextFunction) => {
    if (!authService) {
      return res.status(501).json({ error: "Authentication not configured" });
    }

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { name, email } = req.body;

      if (email !== undefined) {
        if (typeof email !== "string") {
          return res.status(400).json({ error: "Invalid email" });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail === "" || !isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: "Invalid email format" });
        }
        if (normalizedEmail.length > 255) {
          return res.status(400).json({ error: "Email too long" });
        }
      }

      if (name !== undefined) {
        if (name !== null && typeof name !== "string") {
          return res.status(400).json({ error: "Invalid name" });
        }
        if (name && name.length > 100) {
          return res.status(400).json({ error: "Name too long" });
        }
      }

      if (email === undefined && name === undefined) {
        return res.status(400).json({
          error: "At least one field (name or email) must be provided",
        });
      }

      const updatedUser = await authService.updateUserProfile(userId, {
        name,
        email,
      });
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  // PATCH /users/me/onboarding/step — save mid-flow progress
  router.patch(
    "/me/onboarding/step",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService)
        return res.status(501).json({ error: "Auth not configured" });
      try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const step = Number(req.body?.step);
        if (!Number.isInteger(step) || step < 0 || step > 10) {
          return res
            .status(400)
            .json({ error: "step must be an integer 0-10" });
        }

        await authService.updateOnboarding(userId, { step });
        return res.json({ ok: true, step });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /users/me/onboarding/complete — mark onboarding done, return updated user
  router.post(
    "/me/onboarding/complete",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService)
        return res.status(501).json({ error: "Auth not configured" });
      try {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        await authService.updateOnboarding(userId, {
          step: 4,
          completedAt: new Date(),
        });

        const user = await authService.getUserById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        return res.json(user);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
