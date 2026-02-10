import { Router, Request, Response, NextFunction } from "express";
import { ITodoService } from "../interfaces/ITodoService";
import {
  validateCreateTodo,
  validateUpdateTodo,
  validateCreateSubtask,
  validateUpdateSubtask,
  validateReorderTodos,
  validateId,
  validateFindTodosQuery,
} from "../validation";

interface TodoRouterDeps {
  todoService: ITodoService;
  resolveTodoUserId: (req: Request, res: Response) => string | null;
}

export function createTodosRouter({
  todoService,
  resolveTodoUserId,
}: TodoRouterDeps): Router {
  const router = Router();

  /**
   * @openapi
   * /todos:
   *   get:
   *     tags:
   *       - Todos
   *     summary: List todos for the authenticated user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: completed
   *         schema:
   *           type: boolean
   *         description: Filter by completion status
   *       - in: query
   *         name: priority
   *         schema:
   *           type: string
   *           enum: [low, medium, high]
   *         description: Filter by priority
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by exact category name
   *       - in: query
   *         name: sortBy
   *         schema:
   *           type: string
   *           enum: [order, createdAt, updatedAt, dueDate, priority, title]
   *         description: Field used for sorting
   *       - in: query
   *         name: sortOrder
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort direction
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: 1-based page number (requires limit)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Page size limit
   *     responses:
   *       200:
   *         description: List of todos
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Todo'
   *       400:
   *         description: Invalid query parameters
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = resolveTodoUserId(req, res);
      if (!userId) return;

      const query = validateFindTodosQuery(req.query);
      const todos = await todoService.findAll(userId, query);
      res.json(todos);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:id",
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

  router.put(
    "/reorder",
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

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = resolveTodoUserId(req, res);
      if (!userId) return;
      const dto = validateCreateTodo(req.body);
      const todo = await todoService.create(userId, dto);
      res.status(201).json(todo);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/:id",
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

  router.delete(
    "/:id",
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

  router.get(
    "/:id/subtasks",
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

  router.post(
    "/:id/subtasks",
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

  router.put(
    "/:id/subtasks/:subtaskId",
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

  router.delete(
    "/:id/subtasks/:subtaskId",
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

  return router;
}
