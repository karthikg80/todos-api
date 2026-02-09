import express, { Request, Response, NextFunction } from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { ITodoService } from "./interfaces/ITodoService";
import { TodoService } from "./todoService";
import {
  validateCreateTodo,
  validateUpdateTodo,
  validateCreateSubtask,
  validateUpdateSubtask,
  validateReorderTodos,
  validateId,
} from "./validation";
import { AuthService } from "./authService";
import { authMiddleware } from "./authMiddleware";
import { adminMiddleware } from "./adminMiddleware";
import {
  validateRegister,
  validateLogin,
  isValidEmail,
} from "./authValidation";
import { config } from "./config";
import { errorHandler, HttpError } from "./errorHandling";

export function createApp(
  todoService: ITodoService = new TodoService(),
  authService?: AuthService,
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
    // In auth-enabled mode, todo routes must never fall back to a shared user.
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
  const requireAuthIfConfigured = authService
    ? authMiddleware(authService)
    : (_req: Request, res: Response) => {
        res.status(501).json({ error: "Authentication not configured" });
      };

  // Trust Railway proxy for rate limiting and IP detection
  app.set("trust proxy", 1);

  // Restrict CORS in production; keep open defaults in dev/test unless configured.
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
          // Inline style attributes remain in index.html for now.
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          scriptSrcAttr: ["'none'"],
        },
      },
    }),
  );

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, "../public")));

  // API Documentation
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "Todo API Documentation",
    }),
  );

  // API spec endpoint
  app.get("/api-docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Rate limiting configuration
  const isTest = process.env.NODE_ENV === "test";
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window for auth endpoints
    skip: () => isTest, // Bypass rate limiting in test environment
    message: "Too many authentication attempts, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window for general API
    message: "Too many requests, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to API routes
  app.use("/api", apiLimiter);
  app.use("/todos", apiLimiter);
  app.use("/users", apiLimiter);

  // ===== Authentication Routes (Public) =====

  // POST /auth/register - Register a new user
  app.post(
    "/auth/register",
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

  // POST /auth/login - Login user
  app.post(
    "/auth/login",
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

  // POST /auth/refresh - Refresh access token
  app.post(
    "/auth/refresh",
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

  // POST /auth/logout - Revoke refresh token
  app.post(
    "/auth/logout",
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

  // GET /auth/verify - Verify email with token
  app.get(
    "/auth/verify",
    authLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const token = req.query.token as string;

        if (!token || typeof token !== "string") {
          throw new HttpError(400, "Verification token required");
        }

        await authService.verifyEmail(token);
        res.json({ message: "Email verified successfully" });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /auth/resend-verification - Resend verification email
  app.post(
    "/auth/resend-verification",
    authLimiter,
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

        // Use the same response for not-found and already-verified to avoid
        // leaking whether an email exists or its verification status.
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

  // POST /auth/forgot-password - Request password reset
  app.post(
    "/auth/forgot-password",
    authLimiter,
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

  // POST /auth/reset-password - Reset password with token
  app.post(
    "/auth/reset-password",
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

  // GET /auth/bootstrap-admin/status - Check if first-admin bootstrap is available
  app.get(
    "/auth/bootstrap-admin/status",
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

  // POST /auth/bootstrap-admin - Promote current user to first admin
  app.post(
    "/auth/bootstrap-admin",
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

  // Apply authentication middleware to all todo routes if authService is provided
  if (authService) {
    app.use("/todos", authMiddleware(authService));
    app.use("/users", authMiddleware(authService));
    app.use(
      "/admin",
      authMiddleware(authService),
      adminMiddleware(authService),
    );
  }

  // ===== Admin Routes (Protected - Admin Only) =====

  // GET /admin/users - Get all users
  app.get("/admin/users", async (req: Request, res: Response) => {
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
      console.error("Get users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /admin/users/:id/role - Update user role
  app.put("/admin/users/:id/role", async (req: Request, res: Response) => {
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
    } catch (error: any) {
      if (error.message === "Invalid role") {
        return res.status(400).json({ error: error.message });
      }
      if (hasPrismaCode(error, ["P2025"])) {
        return res.status(404).json({ error: "User not found" });
      }
      if (hasPrismaCode(error, ["P2023"])) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }
      console.error("Update role error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // DELETE /admin/users/:id - Delete user
  app.delete("/admin/users/:id", async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: "Authentication not configured" });
    }

    try {
      const id = req.params.id as string;

      // Prevent admin from deleting themselves
      if (id === req.user?.userId) {
        return res
          .status(400)
          .json({ error: "Cannot delete your own account" });
      }

      await authService.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      if (hasPrismaCode(error, ["P2025"])) {
        return res.status(404).json({ error: "User not found" });
      }
      if (hasPrismaCode(error, ["P2023"])) {
        return res.status(400).json({ error: "Invalid user ID format" });
      }
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ===== User Profile Routes (Protected) =====

  // GET /users/me - Get current user profile
  app.get(
    "/users/me",
    async (req: Request, res: Response, next: NextFunction) => {
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
    },
  );

  // PUT /users/me - Update current user profile
  app.put(
    "/users/me",
    async (req: Request, res: Response, next: NextFunction) => {
      if (!authService) {
        return res.status(501).json({ error: "Authentication not configured" });
      }

      try {
        const userId = req.user?.userId;
        if (!userId) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const { name, email } = req.body;

        // Validate input
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
    },
  );

  // ===== Todo Routes (Protected if authService provided) =====

  // GET /todos - Get all todos for authenticated user
  app.get("/todos", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = resolveTodoUserId(req, res);
      if (!userId) return;
      const todos = await todoService.findAll(userId);
      res.json(todos);
    } catch (error) {
      next(error);
    }
  });

  // GET /todos/:id - Get a specific todo for authenticated user
  app.get(
    "/todos/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(id);

        const todo = await todoService.findById(userId, id);
        if (!todo) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.json(todo);
      } catch (error) {
        next(error);
      }
    },
  );

  // PUT /todos/reorder - Reorder todos in bulk for authenticated user
  app.put(
    "/todos/reorder",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        const items = validateReorderTodos(req.body);
        const reorderedTodos = await todoService.reorder(userId, items);

        if (!reorderedTodos) {
          return res.status(404).json({ error: "One or more todos not found" });
        }

        res.json(reorderedTodos);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /todos - Create a new todo for authenticated user
  app.post(
    "/todos",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        const dto = validateCreateTodo(req.body);
        const todo = await todoService.create(userId, dto);
        res.status(201).json(todo);
      } catch (error) {
        next(error);
      }
    },
  );

  // PUT /todos/:id - Update a todo for authenticated user
  app.put(
    "/todos/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(id);

        const dto = validateUpdateTodo(req.body);
        const todo = await todoService.update(userId, id, dto);

        if (!todo) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.json(todo);
      } catch (error) {
        next(error);
      }
    },
  );

  // DELETE /todos/:id - Delete a todo for authenticated user
  app.delete(
    "/todos/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(id);

        const deleted = await todoService.delete(userId, id);
        if (!deleted) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /todos/:id/subtasks - Get all subtasks for a todo
  app.get(
    "/todos/:id/subtasks",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const todoId = req.params.id as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(todoId);

        const subtasks = await todoService.findSubtasks(userId, todoId);
        if (subtasks === null) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.json(subtasks);
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /todos/:id/subtasks - Create a subtask for a todo
  app.post(
    "/todos/:id/subtasks",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const todoId = req.params.id as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(todoId);
        const dto = validateCreateSubtask(req.body);

        const subtask = await todoService.createSubtask(userId, todoId, dto);
        if (!subtask) {
          return res.status(404).json({ error: "Todo not found" });
        }

        res.status(201).json(subtask);
      } catch (error) {
        next(error);
      }
    },
  );

  // PUT /todos/:id/subtasks/:subtaskId - Update a subtask
  app.put(
    "/todos/:id/subtasks/:subtaskId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const todoId = req.params.id as string;
        const subtaskId = req.params.subtaskId as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(todoId);
        validateId(subtaskId);
        const dto = validateUpdateSubtask(req.body);

        const subtask = await todoService.updateSubtask(
          userId,
          todoId,
          subtaskId,
          dto,
        );
        if (!subtask) {
          return res.status(404).json({ error: "Todo or subtask not found" });
        }

        res.json(subtask);
      } catch (error) {
        next(error);
      }
    },
  );

  // DELETE /todos/:id/subtasks/:subtaskId - Delete a subtask
  app.delete(
    "/todos/:id/subtasks/:subtaskId",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const todoId = req.params.id as string;
        const subtaskId = req.params.subtaskId as string;
        const userId = resolveTodoUserId(req, res);
        if (!userId) return;
        validateId(todoId);
        validateId(subtaskId);

        const deleted = await todoService.deleteSubtask(
          userId,
          todoId,
          subtaskId,
        );
        if (!deleted) {
          return res.status(404).json({ error: "Todo or subtask not found" });
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  // Error handling middleware
  app.use(errorHandler);

  return app;
}
