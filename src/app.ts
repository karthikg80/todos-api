import express, { Request, Response, RequestHandler } from "express";
import path from "path";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { ITodoService } from "./interfaces/ITodoService";
import { TodoService } from "./services/todoService";
import { AuthService } from "./services/authService";
import { SocialAuthService } from "./services/socialAuthService";
import { GoogleAuthService } from "./services/googleAuthService";
import { AppleAuthService } from "./services/appleAuthService";
import { PhoneAuthService } from "./services/phoneAuthService";
import { authMiddleware } from "./middleware/authMiddleware";
import { adminMiddleware } from "./middleware/adminMiddleware";
import { config } from "./config";
import { errorHandler } from "./errorHandling";
import { createTodosRouter } from "./routes/todosRouter";
import { createAuthRouter } from "./routes/authRouter";
import { createAdminRouter } from "./routes/adminRouter";
import { createUsersRouter } from "./routes/usersRouter";
import { createAiRouter } from "./routes/aiRouter";
import { createPrioritiesBriefRouter } from "./routes/prioritiesBriefRouter";
import { createAgentRouter } from "./routes/agentRouter";
import { createMcpRouter } from "./routes/mcpRouter";
import {
  IAiSuggestionStore,
  InMemoryAiSuggestionStore,
  PrismaAiSuggestionStore,
} from "./services/aiSuggestionStore";
import { AiPlannerService } from "./services/aiService";
import { UserPlan } from "./routes/aiRouter";
import { createProjectsRouter } from "./routes/projectsRouter";
import { IProjectService } from "./interfaces/IProjectService";
import { IHeadingService } from "./interfaces/IHeadingService";
import { AgentExecutor } from "./agent/agentExecutor";
import { McpOAuthService } from "./services/mcpOAuthService";
import { McpClientService } from "./services/mcpClientService";
import { createMcpPublicRouter } from "./routes/mcpPublicRouter";
import { CaptureService } from "./services/captureService";
import { createCaptureRouter } from "./routes/captureRouter";
import { createPreferencesRouter } from "./routes/preferencesRouter";
import { createAgentEnrollmentRouter } from "./routes/agentEnrollmentRouter";
import { FeedbackService } from "./services/feedbackService";
import { FeedbackDuplicateService } from "./services/feedbackDuplicateService";
import { FeedbackPromotionService } from "./services/feedbackPromotionService";
import { FeedbackTriageService } from "./services/feedbackTriageService";
import { FeedbackAutomationService } from "./services/feedbackAutomationService";
import { FailedAutomationActionService } from "./services/failedAutomationActionService";
import { FeedbackFailureService } from "./services/feedbackFailureService";
import { createFeedbackRouter } from "./routes/feedbackRouter";
import { AgentEnrollmentService } from "./services/agentEnrollmentService";
import {
  authLimiter,
  emailActionLimiter,
  apiLimiter,
  mcpPublicLimiter,
} from "./middleware/rateLimitMiddleware";
import { requestIdMiddleware } from "./infra/logging/requestId";
import { routeLatencyMiddleware } from "./infra/metrics/routeLatency";

export function createApp(
  todoService: ITodoService = new TodoService(),
  authService?: AuthService,
  aiSuggestionStore?: IAiSuggestionStore,
  aiPlannerService?: AiPlannerService,
  aiDailySuggestionLimit?: number,
  aiDailySuggestionLimitByPlan?: Partial<Record<UserPlan, number>>,
  projectService?: IProjectService,
  aiDecisionAssistEnabled?: boolean,
  headingService?: IHeadingService,
) {
  const app = express();
  const persistencePrisma =
    authService instanceof AuthService
      ? authService.getPrismaClient()
      : undefined;
  const runtimeAiSuggestionStore =
    aiSuggestionStore ||
    (persistencePrisma
      ? new PrismaAiSuggestionStore(persistencePrisma)
      : new InMemoryAiSuggestionStore());
  const runtimeAiPlannerService =
    aiPlannerService ||
    new AiPlannerService({
      todoService,
      projectService,
    });
  const agentExecutor = new AgentExecutor({
    todoService,
    projectService,
    persistencePrisma,
    aiPlannerService: runtimeAiPlannerService,
    suggestionStore: runtimeAiSuggestionStore,
  });
  const mcpOAuthService = new McpOAuthService(persistencePrisma);
  const mcpClientService = new McpClientService();
  const captureService = persistencePrisma
    ? new CaptureService(persistencePrisma)
    : null;
  const feedbackService = persistencePrisma
    ? new FeedbackService(persistencePrisma)
    : null;
  const feedbackFailureService = persistencePrisma
    ? new FeedbackFailureService(
        new FailedAutomationActionService(persistencePrisma),
      )
    : null;
  const feedbackTriageService = persistencePrisma
    ? new FeedbackTriageService(persistencePrisma, {
        feedbackFailureService: feedbackFailureService ?? undefined,
      })
    : null;
  const feedbackDuplicateService = persistencePrisma
    ? new FeedbackDuplicateService(persistencePrisma, {
        feedbackFailureService: feedbackFailureService ?? undefined,
      })
    : null;
  const feedbackPromotionService = persistencePrisma
    ? new FeedbackPromotionService(persistencePrisma, {
        feedbackService: feedbackService ?? undefined,
        feedbackDuplicateService: feedbackDuplicateService ?? undefined,
        feedbackFailureService: feedbackFailureService ?? undefined,
      })
    : null;
  const feedbackAutomationService = persistencePrisma
    ? new FeedbackAutomationService(persistencePrisma, {
        feedbackService: feedbackService ?? undefined,
        feedbackDuplicateService: feedbackDuplicateService ?? undefined,
        feedbackPromotionService: feedbackPromotionService ?? undefined,
      })
    : null;

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

  const resolveProjectUserId = (req: Request, res: Response): string | null => {
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

  const resolveAiUserPlan = async (
    userId: string,
  ): Promise<"free" | "pro" | "team"> => {
    if (!authService) {
      return "free";
    }
    const user = await authService.getUserById(userId);
    const plan = user?.plan;
    if (plan === "pro" || plan === "team") {
      return plan;
    }
    return "free";
  };

  const requireAuthIfConfigured: RequestHandler = authService
    ? authMiddleware(authService)
    : (_req: Request, res: Response) => {
        res.status(501).json({ error: "Authentication not configured" });
      };

  app.set("trust proxy", 1);
  app.use(requestIdMiddleware);
  app.use(routeLatencyMiddleware);

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
  }

  app.use(express.json({ limit: config.requestBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: config.formBodyLimit }));
  app.use(cookieParser());
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

  app.use(
    "/vendor/chrono-node",
    express.static(
      path.join(__dirname, "../node_modules/chrono-node/dist/esm"),
    ),
  );
  app.use(express.static(path.join(__dirname, "../client")));

  // Standalone page routes — serve proven standalone HTML pages at product URLs.
  // Must be registered before the /auth API router so GET /auth is intercepted.
  const authPage = path.join(__dirname, "../client/public/auth.html");
  const appPage = path.join(__dirname, "../client/public/app.html");
  const feedbackListPage = path.join(
    __dirname,
    "../client/public/feedback.html",
  );
  const feedbackNewPage = path.join(
    __dirname,
    "../client/public/feedback-new.html",
  );
  app.get("/auth", (_req: Request, res: Response) => res.sendFile(authPage));
  app.get("/app", (_req: Request, res: Response) => res.sendFile(appPage));
  app.get("/app/{*path}", (_req: Request, res: Response) =>
    res.sendFile(appPage),
  );
  app.get("/feedback", (_req: Request, res: Response) =>
    res.sendFile(feedbackListPage),
  );
  app.get("/feedback/new", (_req: Request, res: Response) =>
    res.sendFile(feedbackNewPage),
  );

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

  app.use("/api", apiLimiter);
  app.use("/todos", apiLimiter);
  app.use("/users", apiLimiter);
  app.use("/ai", apiLimiter);
  app.use("/projects", apiLimiter);
  app.use("/agent", apiLimiter);
  app.use("/mcp", apiLimiter);
  app.use("/capture", apiLimiter);
  app.use("/api/feedback", apiLimiter);
  app.use("/preferences", apiLimiter);
  app.use("/oauth", mcpPublicLimiter);
  app.use("/.well-known", mcpPublicLimiter);

  // Social / phone auth services (only instantiated when configured)
  const socialAuthService = persistencePrisma
    ? new SocialAuthService(persistencePrisma)
    : undefined;
  const googleAuthService = config.googleLoginEnabled
    ? new GoogleAuthService()
    : undefined;
  const appleAuthService = config.appleLoginEnabled
    ? new AppleAuthService()
    : undefined;
  const phoneAuthService =
    config.phoneLoginEnabled && persistencePrisma
      ? new PhoneAuthService(persistencePrisma)
      : undefined;

  app.use(
    "/auth",
    createAuthRouter({
      authService,
      mcpOAuthService,
      socialAuthService,
      googleAuthService,
      appleAuthService,
      phoneAuthService,
      authLimiter,
      emailActionLimiter,
      requireAuthIfConfigured,
    }),
  );

  app.use(
    createMcpPublicRouter({
      authService,
      mcpOAuthService,
      mcpClientService,
      googleAuthService,
      socialAuthService,
    }),
  );

  if (authService) {
    app.use("/todos", authMiddleware(authService));
    app.use("/users", authMiddleware(authService));
    app.use("/ai", authMiddleware(authService));
    app.use("/projects", authMiddleware(authService));
    app.use("/capture", authMiddleware(authService));
    app.use("/api/feedback", authMiddleware(authService));
    app.use("/preferences", authMiddleware(authService));
    app.use(
      "/admin",
      authMiddleware(authService),
      adminMiddleware(authService),
    );
  }

  app.use(
    "/admin",
    createAdminRouter({
      authService,
      feedbackService: feedbackService ?? undefined,
      feedbackTriageService: feedbackTriageService ?? undefined,
      feedbackDuplicateService: feedbackDuplicateService ?? undefined,
      feedbackPromotionService: feedbackPromotionService ?? undefined,
      feedbackAutomationService: feedbackAutomationService ?? undefined,
      feedbackFailureService: feedbackFailureService ?? undefined,
    }),
  );
  app.use("/users", createUsersRouter({ authService }));
  app.use(
    "/todos",
    createTodosRouter({
      todoService,
      projectService,
      resolveTodoUserId,
    }),
  );
  app.use(
    "/projects",
    createProjectsRouter({
      projectService,
      headingService,
      resolveProjectUserId,
    }),
  );
  app.use(
    "/ai",
    createAiRouter({
      todoService,
      resolveAiUserId,
      suggestionStore: runtimeAiSuggestionStore,
      aiPlannerService: runtimeAiPlannerService,
      aiDailySuggestionLimit,
      aiDailySuggestionLimitByPlan,
      resolveAiUserPlan,
      projectService,
      decisionAssistEnabled: aiDecisionAssistEnabled,
    }),
  );
  app.use(
    "/ai",
    createPrioritiesBriefRouter({
      todoService,
      projectService,
      resolveUserId: resolveAiUserId,
    }),
  );
  app.use(
    "/agent",
    createAgentRouter({
      agentExecutor,
      authService,
    }),
  );
  app.use(
    "/mcp",
    createMcpRouter({
      agentExecutor,
      authService,
      mcpOAuthService,
    }),
  );

  if (captureService) {
    app.use("/capture", createCaptureRouter(captureService));
  }

  if (feedbackService) {
    app.use("/api/feedback", createFeedbackRouter({ feedbackService }));
  }

  if (persistencePrisma) {
    app.use("/preferences", createPreferencesRouter(persistencePrisma));

    const enrollmentService = new AgentEnrollmentService(persistencePrisma);
    app.use(
      "/api/agent-enrollment",
      createAgentEnrollmentRouter({ enrollmentService, authService }),
    );
  }

  app.use(errorHandler);

  return app;
}
