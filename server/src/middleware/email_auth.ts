import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { NextFunction, Response } from 'express';
import { AuthRequest } from './user_auth';
import { runQuery, runMutation } from '../db/database';

export function isValidEmail(email: string): boolean {
  const emailRGX = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return emailRGX.test(email);
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${process.env.APP_URL}/auth/verify?token=${token}`;
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  await transporter.sendMail({
    from: `"UnitedTransit" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Verify your UnitedTransit account',
    html: `<p>Click the link below to verify your email. It will expire in 24 hours.</p>
           <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
  });
}

export async function createVerificationToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const created_at = new Date().toISOString();
  await runMutation(
    'INSERT INTO verification_token (token, user_id, created_at) VALUES (?, ?, ?)',
    [token, userId, created_at],
  );
  return token;
}

export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const rows = await runQuery('SELECT is_verified FROM user WHERE user_id = ?', [req.userId]);
  if (!rows[0] || rows[0].is_verified !== 1) {
    res.status(403).json({ error: 'Email is not verified' });
    return;
  }
  next();
}
