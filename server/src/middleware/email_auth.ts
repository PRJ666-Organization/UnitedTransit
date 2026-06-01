import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { NextFunction, Response } from 'express';
import { AuthRequest } from './user_auth';
import { runQuery } from '../db/database';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function isValidEmail(email: string): boolean {
  const emailRGX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRGX.test(email);
}

export function createVerificationToken(userId: number): string {
  return jwt.sign(
    { userId, purpose: 'verify' },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' },
  );
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.APP_URL}/auth/verify?token=${token}`;
  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Verify your UnitedTransit account',
    html: `<p>Click the link below to verify your email. It expires in 24 hours.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const rows = await runQuery('SELECT is_verified FROM user WHERE user_id = ?', [req.userId]);
  if (!rows[0] || rows[0].is_verified !== 1) {
    res.status(403).json({ error: 'Email not verified' });
    return;
  }
  next();
}
