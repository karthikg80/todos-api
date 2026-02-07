import express, { Request, Response, NextFunction } from 'express';
import { ITodoService } from './interfaces/ITodoService';
import { TodoService } from './todoService';
import { validateCreateTodo, validateUpdateTodo, validateId, ValidationError } from './validation';

export function createApp(todoService: ITodoService = new TodoService()) {
  const app = express();

  app.use(express.json());

  // GET /todos - Get all todos
  app.get('/todos', async (req: Request, res: Response) => {
    const todos = await todoService.findAll();
    res.json(todos);
  });

  // GET /todos/:id - Get a specific todo
  app.get('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      validateId(id);

      const todo = await todoService.findById(id);
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

  // POST /todos - Create a new todo
  app.post('/todos', async (req: Request, res: Response) => {
    try {
      const dto = validateCreateTodo(req.body);
      const todo = await todoService.create(dto);
      res.status(201).json(todo);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PUT /todos/:id - Update a todo
  app.put('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      validateId(id);

      const dto = validateUpdateTodo(req.body);
      const todo = await todoService.update(id, dto);

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

  // DELETE /todos/:id - Delete a todo
  app.delete('/todos/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      validateId(id);

      const deleted = await todoService.delete(id);
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
