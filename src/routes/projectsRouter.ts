import { Router, Request, Response, NextFunction } from "express";
import { IProjectService } from "../interfaces/IProjectService";
import {
  validateCreateProject,
  validateId,
  validateUpdateProject,
} from "../validation";
import { DuplicateProjectNameError } from "../projectService";

interface ProjectRouterDeps {
  projectService?: IProjectService;
  resolveProjectUserId: (req: Request, res: Response) => string | null;
}

export function createProjectsRouter({
  projectService,
  resolveProjectUserId,
}: ProjectRouterDeps): Router {
  const router = Router();

  /**
   * @openapi
   * /projects:
   *   get:
   *     tags:
   *       - Projects
   *     summary: List projects for the authenticated user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of projects
   *   post:
   *     tags:
   *       - Projects
   *     summary: Create a project for the authenticated user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Created project
   *       409:
   *         description: Project name already exists
   */
  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!projectService) {
        return res.status(501).json({ error: "Projects not configured" });
      }
      const userId = resolveProjectUserId(req, res);
      if (!userId) return;
      const projects = await projectService.findAll(userId);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!projectService) {
        return res.status(501).json({ error: "Projects not configured" });
      }
      const userId = resolveProjectUserId(req, res);
      if (!userId) return;
      const dto = validateCreateProject(req.body);
      const project = await projectService.create(userId, dto);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof DuplicateProjectNameError) {
        return res.status(409).json({ error: "Project name already exists" });
      }
      next(error);
    }
  });

  /**
   * @openapi
   * /projects/{id}:
   *   put:
   *     tags:
   *       - Projects
   *     summary: Rename a project
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Updated project
   *       404:
   *         description: Project not found
   *       409:
   *         description: Project name already exists
   *   delete:
   *     tags:
   *       - Projects
   *     summary: Delete a project and unassign linked todos
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       204:
   *         description: Project deleted
   *       404:
   *         description: Project not found
   */
  router.put(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!projectService) {
          return res.status(501).json({ error: "Projects not configured" });
        }
        const userId = resolveProjectUserId(req, res);
        if (!userId) return;
        const id = req.params.id as string;
        validateId(id);
        const dto = validateUpdateProject(req.body);
        const project = await projectService.update(userId, id, dto);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }
        res.json(project);
      } catch (error) {
        if (error instanceof DuplicateProjectNameError) {
          return res.status(409).json({ error: "Project name already exists" });
        }
        next(error);
      }
    },
  );

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!projectService) {
          return res.status(501).json({ error: "Projects not configured" });
        }
        const userId = resolveProjectUserId(req, res);
        if (!userId) return;
        const id = req.params.id as string;
        validateId(id);
        const deleted = await projectService.delete(userId, id);
        if (!deleted) {
          return res.status(404).json({ error: "Project not found" });
        }
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
