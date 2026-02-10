import express, { Request, Response, RequestHandler } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { ITodoService } from "./interfaces/ITodoService";
import { TodoService } from "./todoService";
import { AuthService } from "./authService";
import { authMiddleware } from "./authMiddleware";
import { adminMiddleware } from "./adminMiddleware";
import { config } from "./config";
import { errorHandler } from "./errorHandling";
import { createTodosRouter } from "./routes/todosRouter";
import { createAuthRouter } from "./routes/authRouter";
import { createAdminRouter } from "./routes/adminRouter";
import { createUsersRouter } from "./routes/usersRouter";
import { createAiRouter } from "./routes/aiRouter";
import { IAiSuggestionStore } from "./aiSuggestionStore";
import { AiPlannerService } from "./aiService";

export function createApp(
  todoService: ITodoService = new TodoService(),
  authService?: AuthService,
  aiSuggestionStore?: IAiSuggestionStore,
  aiPlannerService?: AiPlannerService,
  aiDailySuggestionLimit?: number,
) {
  const app = express();

  const hasPrismaCode = (error: unknown, codes: string[]): boolean => {
    if (!error || typeof error !== "object" || !("code" in error)) {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" && codes.includes(code);
  };

  const resolveTodoUserId = (req: Request, res: Response): string | null => {
    if (authService) {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
      return userId;
    }

    return req.user?.userId || "default-user";
  };

  const resolveAiUserId = (req: Request, res: Response): string | null => {
    if (authService) {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
      return userId;
    }

    return req.user?.userId || "default-user";
  };

  const requireAuthIfConfigured: RequestHandler = authService
    ? authMiddleware(authService)
    : (_req: Request, res: Response) => {
        res.status(501).json({ error: "Authentication not configured" });
      };

  app.set("trust proxy", 1);

  if (config.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: (origin, callback) => {
          if (!origin || config.corsOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(null, false);
        },
        credentials: true,
      }),
    );
  } else {
    app.use(cors());
  }

  app.use(express.json());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrcAttr: ["'none'"],
        },
      },
    }),
  );

  app.use(express.static(path.join(__dirname, "../public")));

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Todo API Documentation",
    }),
  );

  app.get("/api-docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  const isTest = process.env.NODE_ENV === "test";
  const noLimit: RequestHandler = (_req, _res, next) => next();
  const authLimiter = isTest
    ? noLimit
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: "Too many authentication attempts, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      });

  const emailActionLimiter = isTest
    ? noLimit
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: "Too many email actions, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      });

  const apiLimiter = isTest
    ? noLimit
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        message: "Too many requests, please try again later",
        standardHeaders: true,
        legacyHeaders: false,
      });

  app.use("/api", apiLimiter);
  app.use("/todos", apiLimiter);
  app.use("/users", apiLimiter);
  app.use("/ai", apiLimiter);

  app.use(
    "/auth",
    createAuthRouter({
      authService,
      authLimiter,
      emailActionLimiter,
      requireAuthIfConfigured,
    }),
  );

  if (authService) {
    app.use("/todos", authMiddleware(authService));
    app.use("/users", authMiddleware(authService));
    app.use("/ai", authMiddleware(authService));
    app.use(
      "/admin",
      authMiddleware(authService),
      adminMiddleware(authService),
    );
  }

  app.use("/admin", createAdminRouter({ authService, hasPrismaCode }));
  app.use("/users", createUsersRouter({ authService }));
  app.use("/todos", createTodosRouter({ todoService, resolveTodoUserId }));
  app.use(
    "/ai",
    createAiRouter({
      todoService,
      resolveAiUserId,
      suggestionStore: aiSuggestionStore,
      aiPlannerService,
      aiDailySuggestionLimit,
    }),
  );

  app.use(errorHandler);

  return app;
}
