import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery, runMutation } from '../db/database';

interface AuthRequest extends Request {
  userId?: number;
}

const router = Router();

const authenticate = (req: AuthRequest, res: Response, next: Function) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bookmarks = await runQuery(
      'SELECT bookmark_id, trip_name, locations_json FROM bookmark WHERE user_id = ?',
      [req.userId!],
    );
    res.json(bookmarks);
  } catch (error) {
    console.error('[Bookmarks] GET failed:', error);
    res.status(500).json({ error: 'Failed to load bookmarks' });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, locations } = req.body;
    if (!name || !locations || !Array.isArray(locations)) {
      res.status(400).json({ error: 'Name and locations array required.' });
      return;
    }
    const save_date = new Date().toISOString().split('T')[0];
    const locations_json = JSON.stringify(locations);
    const result = await runMutation(
      'INSERT INTO bookmark (user_id, trip_name, save_date, locations_json) VALUES (?, ?, ?, ?)',
      [req.userId, name, save_date, locations_json],
    );
    res.status(201).json({ bookmarkId: result.lastInsertRowId, name });
  } catch (error) {
    console.error('[Bookmarks] POST failed:', error);
    res.status(500).json({ error: 'Failed to create bookmark' });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await runMutation(
      'DELETE FROM bookmark WHERE bookmark_id = ? AND user_id = ?',
      [parseInt(req.params.id as string), req.userId],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('[Bookmarks] DELETE failed:', error);
    res.status(500).json({ error: 'Failed to delete bookmark' });
  }
});

export default router;
