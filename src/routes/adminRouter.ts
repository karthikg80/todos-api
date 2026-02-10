import { Router, Request, Response } from "express";
import { AuthService } from "../authService";

interface AdminRouterDeps {
  authService?: AuthService;
  hasPrismaCode: (error: unknown, codes: string[]) => boolean;
}

export function createAdminRouter({
  authService,
  hasPrismaCode,
}: AdminRouterDeps): Router {
  const router = Router();

  router.get("/users", async (req: Request, res: Response) => {
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

  router.put("/users/:id/role", async (req: Request, res: Response) => {
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

  router.delete("/users/:id", async (req: Request, res: Response) => {
    if (!authService) {
      return res.status(501).json({ error: "Authentication not configured" });
    }

    try {
      const id = req.params.id as string;

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

  return router;
}
