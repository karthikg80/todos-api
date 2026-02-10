import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from "express";
import { AuthService } from "../authService";
import { validateRegister, validateLogin } from "../authValidation";
import { HttpError } from "../errorHandling";

interface AuthRouterDeps {
  authService?: AuthService;
  authLimiter: RequestHandler;
  emailActionLimiter: RequestHandler;
  requireAuthIfConfigured: RequestHandler;
}

export function createAuthRouter({
  authService,
  authLimiter,
  emailActionLimiter,
  requireAuthIfConfigured,
}: AuthRouterDeps): Router {
  const router = Router();

  router.post(
    "/register",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const validation = validateRegister(req.body);

        if (!validation.valid) {
          return res.status(400).json({
            error: "Validation failed",
            errors: validation.errors,
          });
        }

        const result = await authService.register(validation.dto!);
        res.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/login",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const validation = validateLogin(req.body);

        if (!validation.valid) {
          return res.status(400).json({
            error: "Validation failed",
            errors: validation.errors,
          });
        }

        const result = await authService.login(validation.dto!);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/refresh",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
          throw new HttpError(400, "Refresh token required");
        }

        const result = await authService.refreshAccessToken(refreshToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/logout",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { refreshToken } = req.body;

        if (refreshToken) {
          await authService.revokeRefreshToken(refreshToken);
        }

        res.json({ message: "Logged out successfully" });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/verify",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      const wantsHtml = (req.get("accept") || "").includes("text/html");

      try {
        const token = req.query.token as string;

        if (!token || typeof token !== "string") {
          throw new HttpError(400, "Verification token required");
        }

        await authService.verifyEmail(token);
        if (wantsHtml) {
          return res.redirect(303, "/?verified=1");
        }
        res.json({ message: "Email verified successfully" });
      } catch (error) {
        if (wantsHtml) {
          return res.redirect(303, "/?verified=0");
        }
        next(error);
      }
    },
  );

  router.post(
    "/resend-verification",
    emailActionLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const { email } = req.body;
        const normalizedEmail =
          typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedEmail) {
          return res.status(400).json({ error: "Email required" });
        }

        const user = await authService.getUserByEmail(normalizedEmail);

        if (user && !user.isVerified) {
          await authService.sendVerificationEmail(user.id);
        }

        res.json({
          message:
            "If the email exists and is not verified, a verification link has been sent",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/forgot-password",
    emailActionLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const email = req.body.email as string;
        const normalizedEmail =
          typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedEmail) {
          return res.status(400).json({ error: "Email required" });
        }

        await authService.requestPasswordReset(normalizedEmail);
        res.json({
          message: "If the email exists, a reset link has been sent",
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/reset-password",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const token = req.body.token as string;
        const password = req.body.password as string;

        if (!token || !password) {
          return res.status(400).json({ error: "Token and password required" });
        }

        if (password.length < 8) {
          return res
            .status(400)
            .json({ error: "Password must be at least 8 characters" });
        }

        if (password.length > 72) {
          return res
            .status(400)
            .json({ error: "Password cannot exceed 72 characters" });
        }

        await authService.resetPassword(token, password);
        res.json({ message: "Password reset successfully" });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/bootstrap-admin/status",
    requireAuthIfConfigured,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const status = await authService.getAdminBootstrapStatus(userId);
        res.json(status);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/bootstrap-admin",
    authLimiter,
    requireAuthIfConfigured,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const secret =
          typeof req.body.secret === "string" ? req.body.secret.trim() : "";
        if (!secret) {
          return res.status(400).json({ error: "Bootstrap secret required" });
        }

        const user = await authService.bootstrapAdmin(userId, secret);
        res.json({ message: "Admin access granted", user });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
