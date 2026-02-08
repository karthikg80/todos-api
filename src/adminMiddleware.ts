import { Request, Response, NextFunction } from 'express';
import { AuthService } from './authService';

/**
 * Middleware to check if user is an admin
 */
export function adminMiddleware(authService: AuthService) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const isAdmin = await authService.isAdmin(userId);

      if (!isAdmin) {
        res.status(403).json({ error: 'Forbidden: Admin access required' });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
