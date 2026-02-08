import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import { ITodoService } from './interfaces/ITodoService';
import { TodoService } from './todoService';
import {
  validateCreateTodo,
  validateUpdateTodo,
  validateCreateSubtask,
  validateUpdateSubtask,
  validateReorderTodos,
  validateId,
  ValidationError
} from './validation';
import { AuthService } from './authService';
import { authMiddleware } from './authMiddleware';
import { adminMiddleware } from './adminMiddleware';
import { validateRegister, validateLogin, isValidEmail } from './authValidation';

export function createApp(
  todoService: ITodoService = new TodoService(),
  authService?: AuthService
) {
  const app = express();
  const hasPrismaCode = (error: unknown, codes: string[]): boolean => {
    if (!error || typeof error !== 'object' || !('code' in error)) {
      return false;
    }
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && codes.includes(code);
  };

  // Trust Railway proxy for rate limiting and IP detection
  app.set('trust proxy', 1);

  // Enable CORS for all routes
  app.use(cors());

  app.use(express.json());

  // Serve static files from public directory
  app.use(express.static(path.join(__dirname, '../public')));

  // API Documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Todo API Documentation',
  }));

  // API spec endpoint
  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Rate limiting configuration
  const isTest = process.env.NODE_ENV === 'test';
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window for auth endpoints
    skip: () => isTest, // Bypass rate limiting in test environment
    message: 'Too many authentication attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window for general API
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply rate limiting to API routes
  app.use('/api', apiLimiter);
  app.use('/todos', apiLimiter);
  app.use('/users', apiLimiter);

  // ===== Authentication Routes (Public) =====

  // POST /auth/register - Register a new user
  app.post('/auth/register', authLimiter, async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const validation = validateRegister(req.body);

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: validation.errors
        });
      }

      const result = await authService.register(validation.dto!);
      res.status(201).json(result);
    } catch (error: any) {
      if (error.message === 'Email already registered') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/login - Login user
  app.post('/auth/login', authLimiter, async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const validation = validateLogin(req.body);

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          errors: validation.errors
        });
      }

      const result = await authService.login(validation.dto!);
      res.json(result);
    } catch (error: any) {
      if (error.message === 'Invalid credentials') {
        return res.status(401).json({ error: error.message });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/refresh - Refresh access token
  app.post('/auth/refresh', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      const result = await authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('not found')) {
        return res.status(401).json({ error: error.message });
      }
      console.error('Refresh token error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/logout - Revoke refresh token
  app.post('/auth/logout', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /auth/verify - Verify email with token
  app.get('/auth/verify', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const token = req.query.token as string;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Verification token required' });
      }

      await authService.verifyEmail(token);
      res.json({ message: 'Email verified successfully' });
    } catch (error: any) {
      if (error.message === 'Invalid verification token') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/resend-verification - Resend verification email
  app.post('/auth/resend-verification', authLimiter, async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const { email } = req.body;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email required' });
      }

      const user = await authService.getUserByEmail(normalizedEmail);

      if (!user) {
        // Don't reveal if email exists
        return res.json({ message: 'If the email exists and is not verified, a verification link has been sent' });
      }

      if (user.isVerified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      await authService.sendVerificationEmail(user.id);
      res.json({ message: 'Verification email sent successfully' });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/forgot-password - Request password reset
  app.post('/auth/forgot-password', authLimiter, async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const email = req.body.email as string;
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!normalizedEmail) {
        return res.status(400).json({ error: 'Email required' });
      }

      await authService.requestPasswordReset(normalizedEmail);
      res.json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /auth/reset-password - Reset password with token
  app.post('/auth/reset-password', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const token = req.body.token as string;
      const password = req.body.password as string;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token and password required' });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      await authService.resetPassword(token, password);
      res.json({ message: 'Password reset successfully' });
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Apply authentication middleware to all todo routes if authService is provided
  if (authService) {
    app.use('/todos', authMiddleware(authService));
    app.use('/users', authMiddleware(authService));
    app.use('/admin', authMiddleware(authService), adminMiddleware(authService));
  }

  // ===== Admin Routes (Protected - Admin Only) =====

  // GET /admin/users - Get all users
  app.get('/admin/users', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const users = await authService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /admin/users/:id/role - Update user role
  app.put('/admin/users/:id/role', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const id = req.params.id as string;
      const role = req.body.role as string;

      if (!role || !['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
      }

      await authService.updateUserRole(id, role as 'user' | 'admin');
      res.json({ message: 'User role updated successfully' });
    } catch (error: any) {
      if (error.message === 'Invalid role') {
        return res.status(400).json({ error: error.message });
      }
      if (hasPrismaCode(error, ['P2025'])) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (hasPrismaCode(error, ['P2023'])) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      console.error('Update role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /admin/users/:id - Delete user
  app.delete('/admin/users/:id', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const id = req.params.id as string;

      // Prevent admin from deleting themselves
      if (id === req.user?.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
      }

      await authService.deleteUser(id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      if (hasPrismaCode(error, ['P2025'])) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (hasPrismaCode(error, ['P2023'])) {
        return res.status(400).json({ error: 'Invalid user ID format' });
      }
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ===== User Profile Routes (Protected) =====

  // GET /users/me - Get current user profile
  app.get('/users/me', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await authService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /users/me - Update current user profile
  app.put('/users/me', async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: 'Authentication not configured' });
    }

    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, email } = req.body;

      // Validate input
      if (email !== undefined) {
        if (typeof email !== 'string') {
          return res.status(400).json({ error: 'Invalid email' });
        }
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail === '' || !isValidEmail(normalizedEmail)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        if (normalizedEmail.length > 255) {
          return res.status(400).json({ error: 'Email too long' });
        }
      }

      if (name !== undefined) {
        if (name !== null && typeof name !== 'string') {
          return res.status(400).json({ error: 'Invalid name' });
        }
        if (name && name.length > 100) {
          return res.status(400).json({ error: 'Name too long' });
        }
      }

      const updatedUser = await authService.updateUserProfile(userId, { name, email });
      res.json(updatedUser);
    } catch (error: any) {
      if (error.message === 'Email already in use') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ===== Todo Routes (Protected if authService provided) =====

  // GET /todos - Get all todos for authenticated user
  app.get('/todos', async (req: Request, res: Response) => {
    const userId = req.user?.userId || 'default-user';
    const todos = await todoService.findAll(userId);
    res.json(todos);
  });

  // GET /todos/:id - Get a specific todo for authenticated user
  app.get('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.userId || 'default-user';
      validateId(id);

      const todo = await todoService.findById(userId, id);
      if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(todo);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /todos/reorder - Reorder todos in bulk for authenticated user
  app.put('/todos/reorder', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || 'default-user';
      const items = validateReorderTodos(req.body);
      const reorderedTodos = await todoService.reorder(userId, items);

      if (!reorderedTodos) {
        return res.status(404).json({ error: 'One or more todos not found' });
      }

      res.json(reorderedTodos);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /todos - Create a new todo for authenticated user
  app.post('/todos', async (req: Request, res: Response) => {
    try {
      const userId = req.user?.userId || 'default-user';
      const dto = validateCreateTodo(req.body);
      const todo = await todoService.create(userId, dto);
      res.status(201).json(todo);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /todos/:id - Update a todo for authenticated user
  app.put('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.userId || 'default-user';
      validateId(id);

      const dto = validateUpdateTodo(req.body);
      const todo = await todoService.update(userId, id, dto);

      if (!todo) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(todo);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /todos/:id - Delete a todo for authenticated user
  app.delete('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const userId = req.user?.userId || 'default-user';
      validateId(id);

      const deleted = await todoService.delete(userId, id);
      if (!deleted) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /todos/:id/subtasks - Get all subtasks for a todo
  app.get('/todos/:id/subtasks', async (req: Request, res: Response) => {
    try {
      const todoId = req.params.id as string;
      const userId = req.user?.userId || 'default-user';
      validateId(todoId);

      const subtasks = await todoService.findSubtasks(userId, todoId);
      if (subtasks === null) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.json(subtasks);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /todos/:id/subtasks - Create a subtask for a todo
  app.post('/todos/:id/subtasks', async (req: Request, res: Response) => {
    try {
      const todoId = req.params.id as string;
      const userId = req.user?.userId || 'default-user';
      validateId(todoId);
      const dto = validateCreateSubtask(req.body);

      const subtask = await todoService.createSubtask(userId, todoId, dto);
      if (!subtask) {
        return res.status(404).json({ error: 'Todo not found' });
      }

      res.status(201).json(subtask);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /todos/:id/subtasks/:subtaskId - Update a subtask
  app.put('/todos/:id/subtasks/:subtaskId', async (req: Request, res: Response) => {
    try {
      const todoId = req.params.id as string;
      const subtaskId = req.params.subtaskId as string;
      const userId = req.user?.userId || 'default-user';
      validateId(todoId);
      validateId(subtaskId);
      const dto = validateUpdateSubtask(req.body);

      const subtask = await todoService.updateSubtask(userId, todoId, subtaskId, dto);
      if (!subtask) {
        return res.status(404).json({ error: 'Todo or subtask not found' });
      }

      res.json(subtask);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /todos/:id/subtasks/:subtaskId - Delete a subtask
  app.delete('/todos/:id/subtasks/:subtaskId', async (req: Request, res: Response) => {
    try {
      const todoId = req.params.id as string;
      const subtaskId = req.params.subtaskId as string;
      const userId = req.user?.userId || 'default-user';
      validateId(todoId);
      validateId(subtaskId);

      const deleted = await todoService.deleteSubtask(userId, todoId, subtaskId);
      if (!deleted) {
        return res.status(404).json({ error: 'Todo or subtask not found' });
      }

      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
