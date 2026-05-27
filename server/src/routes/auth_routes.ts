import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database';

const router = Router();

router.post('/login', (req: Request, res: Response): void => {
    const { email, pwd } = req.body;
    if (!email || !pwd){
        res.status(400).json({ error: 'Email and password are required field' });
        return;
    }

    const user = db.prepare('SELECT * FROM user WHERE email = ?').get(email) as {
        user_id: number;
        password_hash: string;
        is_active: number;
        is_admin: boolean; // only use 0 or 1 not True or False
    } | undefined;

    if (!user || user.is_active === 0) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
    }

    // TODO: pwd hashing

    const token = jwt.sign (
        { userId: user.user_id, isAdmin: user.is_admin, },
        process.env.JWT_SECRET as string,
        { expiresIn: '24h'}
    );
    res.json({ token });
}); 

export default router