import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery, runMutation } from '../db/database';

interface AuthRequest extends Request {
  userId?: number;
}

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';

// Middleware to authenticate user
const authenticate = (req: AuthRequest, res: Response, next: Function) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /user/home - Get user's home address
router.get('/home', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await runQuery(
      `SELECT home_address, home_lat, home_lng FROM user WHERE user_id = ?`,
      [req.userId]
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result[0];
    res.json({
      homeAddress: user.home_address,
      homeLat: user.home_lat,
      homeLng: user.home_lng,
    });
  } catch (error) {
    console.error('[User] Get home failed:', error);
    res.status(500).json({ error: 'Failed to get home address' });
  }
});

// POST /user/home - Set user's home address
router.post('/home', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { homeAddress, homeLat, homeLng } = req.body;

    if (!homeLat || !homeLng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    await runMutation(
      `UPDATE user SET home_address = ?, home_lat = ?, home_lng = ? WHERE user_id = ?`,
      [homeAddress || null, homeLat, homeLng, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[User] Set home failed:', error);
    res.status(500).json({ error: 'Failed to set home address' });
  }
});

// DELETE /user/home - Remove user's home address
router.delete('/home', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await runMutation(
      `UPDATE user SET home_address = NULL, home_lat = NULL, home_lng = NULL WHERE user_id = ?`,
      [req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('[User] Delete home failed:', error);
    res.status(500).json({ error: 'Failed to remove home address' });
  }
});

export default router;