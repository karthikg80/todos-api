import express, { Request, Response, NextFunction } from 'express';
import { ITodoService } from './interfaces/ITodoService';
import { TodoService } from './todoService';
import { validateCreateTodo, validateUpdateTodo, validateId, ValidationError } from './validation';
import { AuthService } from './authService';
import { authMiddleware } from './authMiddleware';
import { validateRegister, validateLogin } from './authValidation';

export function createApp(
  todoService: ITodoService = new TodoService(),
  authService?: AuthService
) {
  const app = express();

  app.use(express.json());

  // ===== Authentication Routes (Public) =====

  // POST /auth/register - Register a new user
  app.post('/auth/register', async (req: Request, res: Response) => {
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
  app.post('/auth/login', async (req: Request, res: Response) => {
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

  // Apply authentication middleware to all todo routes if authService is provided
  if (authService) {
    app.use('/todos', authMiddleware(authService));
  }

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

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
