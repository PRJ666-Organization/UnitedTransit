import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { runQuery, runMutation } from '../db/database';

const SALT_ROUNDS = 15;
const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const existing = await runQuery('SELECT user_id FROM user WHERE email = ?', [email]);
  if (existing.length > 0) {
    res.status(409).json({ error: 'Email already registered.' });
    return;
  }

  const password_hash = bcrypt.hashSync(pwd, SALT_ROUNDS);
  const created_at = new Date().toISOString().split('T')[0];

  const result = await runMutation(
    'INSERT INTO user (email, password_hash, created_at) VALUES (?, ?, ?)',
    [email, password_hash, created_at],
  );

  const token = jwt.sign(
    { userId: result.lastInsertRowId, isAdmin: false },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' },
  );
  res.status(201).json({ token, userId: result.lastInsertRowId });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    res.status(400).json({ error: 'Email and password are required field' });
    return;
  }

  const users = await runQuery('SELECT * FROM user WHERE email = ?', [email]);
  const user = users[0] as
    | {
        user_id: number;
        password_hash: string;
        is_active: number;
        is_admin: number;
      }
    | undefined;

//   if (!user || user.is_active === 0) {
//     res.status(401).json({ error: 'Invalid credentials' });
//     return;
//   }

  if (!bcrypt.compareSync(pwd, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user.user_id, isAdmin: user.is_admin },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' },
  );
  res.json({ token });
});

export default router;
