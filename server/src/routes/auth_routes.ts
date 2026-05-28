import bcrypt from 'bcrypt';
import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database.web';

const SALT_ROUNDS = 15;
const router = Router();

router.post('/register', (req: Request, res: Response): void => {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const existing = db.prepare('SELECT user_id FROM user WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered.' });
    return;
  }

  const password_hash = bcrypt.hashSync(pwd, SALT_ROUNDS);
  const created_at = new Date().toISOString().split('T')[0];

  const result = db
    .prepare('INSERT INTO user (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(email, password_hash, created_at);

  const token = jwt.sign(
    { userId: result.lastInsertRowid, isAdmin: false },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' },
  );
  res.status(201).json({ token, userId: result.lastInsertRowid });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, pwd } = req.body;
  if (!email || !pwd) {
    res.status(400).json({ error: 'Email and password are required field' });
    return;
  }

  const user = db.prepare('SELECT * FROM user WHERE email = ?').get(email) as
    | {
        user_id: number;
        password_hash: string;
        is_active: number;
        is_admin: boolean; // only use 0 or 1 not True or False
      }
    | undefined;

  if (!user || user.is_active === 0) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

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
