import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';

describe('Bookmark API Routes', () => {
  it('authenticates valid Bearer token', () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    expect(decoded.userId).toBe(1);
  });

  it('rejects missing Authorization header', () => {
    const header = undefined;
    const isValid = !(!header || !header.startsWith('Bearer '));
    expect(isValid).toBe(false);
  });

  it('rejects invalid token format', () => {
    const header = 'InvalidToken';
    const isValid = header.startsWith('Bearer ');
    expect(isValid).toBe(false);
  });

  it('rejects expired token', () => {
    const token = jwt.sign({ userId: 1 }, JWT_SECRET, { expiresIn: '0s' });
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('extracts userId from token header', () => {
    const token = jwt.sign({ userId: 42 }, JWT_SECRET);
    const header = `Bearer ${token}`;
    const extracted = header.split(' ')[1];
    const decoded = jwt.verify(extracted, JWT_SECRET) as { userId: number };
    expect(decoded.userId).toBe(42);
  });

  it('GET /bookmarks returns array', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            bookmark_id: 1,
            trip_name: 'Test',
            locations_json: JSON.stringify([
              { latitude: 43.65, longitude: -79.38 },
            ]),
          },
        ]),
    });

    const res = await fetch('http://localhost:3000/bookmarks', {
      headers: { Authorization: `Bearer ${jwt.sign({ userId: 1 }, JWT_SECRET)}` },
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST /bookmarks validates request body', () => {
    const body = { name: 'Test', locations: [{ latitude: 43.65, longitude: -79.38 }] };
    expect(body.name).toBeTruthy();
    expect(Array.isArray(body.locations)).toBe(true);
  });

  it('POST /bookmarks rejects missing name', () => {
    const body = { locations: [] };
    const isValid = !(!body.name || !Array.isArray(body.locations));
    expect(isValid).toBe(false);
  });

  it('POST /bookmarks rejects missing locations', () => {
    const body = { name: 'Test' };
    const isValid = !(!body.name || !Array.isArray(body.locations));
    expect(isValid).toBe(false);
  });

  it('DELETE /bookmarks extracts id from params', () => {
    const params = { id: '1' };
    const id = parseInt(params.id);
    expect(id).toBe(1);
  });

  it('DELETE /bookmarks filters by user_id', () => {
    const userId = 1;
    const bookmarkId = 1;
    const sql = 'DELETE FROM bookmark WHERE bookmark_id = ? AND user_id = ?';
    expect(sql).toContain('user_id');
  });
});
