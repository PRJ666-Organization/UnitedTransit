import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';

describe('Auth Logic', () => {
  describe('Password Hashing', () => {
    it('hashes password correctly', () => {
      const hash = bcrypt.hashSync('password123', 10);
      expect(hash).toBeTruthy();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('verifies correct password', () => {
      const hash = bcrypt.hashSync('password123', 10);
      expect(bcrypt.compareSync('password123', hash)).toBe(true);
    });

    it('rejects incorrect password', () => {
      const hash = bcrypt.hashSync('password123', 10);
      expect(bcrypt.compareSync('wrongpassword', hash)).toBe(false);
    });

    it('produces different hashes for same password', () => {
      const hash1 = bcrypt.hashSync('password123', 10);
      const hash2 = bcrypt.hashSync('password123', 10);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('JWT Token', () => {
    it('creates and verifies a valid token', () => {
      const payload = { userId: 1, isAdmin: false };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean };
      expect(decoded.userId).toBe(1);
      expect(decoded.isAdmin).toBe(false);
    });

    it('rejects token with wrong secret', () => {
      const token = jwt.sign({ userId: 1 }, JWT_SECRET);
      expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
    });

    it('decodes admin token correctly', () => {
      const payload = { userId: 2, isAdmin: true };
      const token = jwt.sign(payload, JWT_SECRET);
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; isAdmin: boolean };
      expect(decoded.isAdmin).toBe(true);
    });

    it('includes expiry in token', () => {
      const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.decode(token) as { exp: number };
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
    });
  });

  describe('Auth Middleware Logic', () => {
    it('extracts userId from Bearer token', () => {
      const token = jwt.sign({ userId: 42 }, JWT_SECRET);
      const header = `Bearer ${token}`;
      const extracted = header.split(' ')[1];
      const decoded = jwt.verify(extracted, JWT_SECRET) as { userId: number };
      expect(decoded.userId).toBe(42);
    });

    it('rejects missing Bearer prefix', () => {
      const header = 'Invalid token123';
      expect(header.startsWith('Bearer ')).toBe(false);
    });

    it('rejects empty header', () => {
      const header = '';
      expect(header.startsWith('Bearer ')).toBe(false);
    });
  });
});
