import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery, runMutation } from '../db/database';

interface AuthRequest extends Request {
  userId?: number;
}

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// Optional authentication - continues even without token
const optionalAuthenticate = (req: AuthRequest, res: Response, next: Function) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    // For anonymous users, continue without userId
    next();
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    // Invalid token, continue as anonymous
    next();
  }
};

// GET /search-history - Get recent searches (max 3)
router.get('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = 3;

    if (req.userId) {
      // Authenticated user - fetch from database
      const searches = await runQuery(
        `SELECT search_id, locations_json, searched_at
         FROM search_history
         WHERE user_id = ?
         ORDER BY searched_at DESC
         LIMIT ?`,
        [req.userId, limit]
      );
      res.json(searches);
    } else {
      // Anonymous user - use device_id from header
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) {
        res.json([]);
        return;
      }
      const searches = await runQuery(
        `SELECT search_id, locations_json, searched_at
         FROM search_history
         WHERE device_id = ?
         ORDER BY searched_at DESC
         LIMIT ?`,
        [deviceId, limit]
      );
      res.json(searches);
    }
  } catch (error) {
    console.error('[SearchHistory] GET failed:', error);
    res.status(500).json({ error: 'Failed to load search history' });
  }
});

// POST /search-history - Save a search
router.post('/', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { locations } = req.body;
    if (!locations || !Array.isArray(locations) || locations.length < 2) {
      res.status(400).json({ error: 'Locations array with at least 2 points required.' });
      return;
    }

    const searched_at = new Date().toISOString();
    const locations_json = JSON.stringify(locations);

    if (req.userId) {
      // Authenticated user
      const result = await runMutation(
        'INSERT INTO search_history (user_id, locations_json, searched_at) VALUES (?, ?, ?)',
        [req.userId, locations_json, searched_at]
      );
      res.status(201).json({ searchId: result.lastInsertRowId });
    } else {
      // Anonymous user - use device_id
      const deviceId = req.headers['x-device-id'] as string;
      if (!deviceId) {
        res.status(400).json({ error: 'Device ID required for anonymous users' });
        return;
      }
      const result = await runMutation(
        'INSERT INTO search_history (device_id, locations_json, searched_at) VALUES (?, ?, ?)',
        [deviceId, locations_json, searched_at]
      );
      res.status(201).json({ searchId: result.lastInsertRowId });
    }
  } catch (error) {
    console.error('[SearchHistory] POST failed:', error);
    res.status(500).json({ error: 'Failed to save search history' });
  }
});

// DELETE /search-history/:id - Delete a specific search
router.delete('/:id', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const searchId = parseInt(req.params.id as string);

    if (req.userId) {
      await runMutation(
        'DELETE FROM search_history WHERE search_id = ? AND user_id = ?',
        [searchId, req.userId]
      );
    } else {
      const deviceId = req.headers['x-device-id'] as string;
      if (deviceId) {
        await runMutation(
          'DELETE FROM search_history WHERE search_id = ? AND device_id = ?',
          [searchId, deviceId]
        );
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('[SearchHistory] DELETE failed:', error);
    res.status(500).json({ error: 'Failed to delete search history' });
  }
});

export default router;