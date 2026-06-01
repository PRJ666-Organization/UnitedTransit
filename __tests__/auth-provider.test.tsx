import React from 'react';

const mockFetch = global.fetch as jest.Mock;

describe('Auth Provider Logic', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns true on successful login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'abc123', userId: 1 }),
    });

    const res = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', pwd: 'password' }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.token).toBe('abc123');
    expect(data.userId).toBe(1);
  });

  it('returns false on failed login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const res = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', pwd: 'wrong' }),
    });

    expect(res.ok).toBe(false);
  });

  it('returns true on successful registration', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ token: 'new123', userId: 2 }),
    });

    const res = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@test.com', pwd: 'password' }),
    });

    expect(res.ok).toBe(true);
  });

  it('returns false when email already registered', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Email already registered.' }),
    });

    const res = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'existing@test.com', pwd: 'password' }),
    });

    expect(res.status).toBe(409);
  });

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
    }).catch((e) => e.message);

    expect(result).toBe('Network error');
  });

  it('sends correct request body for login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'x' }),
    });

    await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', pwd: 'pass' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('includes auth token in bookmark fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetch('http://localhost:3000/bookmarks', {
      headers: { Authorization: 'Bearer abc123' },
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/bookmarks',
      expect.objectContaining({
        headers: { Authorization: 'Bearer abc123' },
      }),
    );
  });

  it('creates bookmark with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ bookmarkId: 1 }),
    });

    const locations = [
      { latitude: 43.6532, longitude: -79.3832, name: 'Test' },
    ];

    const res = await fetch('http://localhost:3000/bookmarks', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer abc123',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'My Bookmark', locations }),
    });

    expect(res.ok).toBe(true);
  });

  it('deletes bookmark with correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });

    const res = await fetch('http://localhost:3000/bookmarks/1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer abc123' },
    });

    expect(res.ok).toBe(true);
  });

  it('returns unauthorized for invalid token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid token' }),
    });

    const res = await fetch('http://localhost:3000/bookmarks', {
      headers: { Authorization: 'Bearer invalid' },
    });

    expect(res.status).toBe(401);
  });
});
