import React, { useState } from 'react';
import { AuthContext, AuthUser, BookmarkLocation } from '@/hooks/use-auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingVerifyUrl, setPendingVerifyUrl] = useState<string | null>(null);
  const [activeBookmarkLocations, setActiveBookmarkLocations] = useState<BookmarkLocation[]>([]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const url = `${API_URL}/auth/login`;
      console.log('[Auth] Login POST', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pwd: password }),
      });
      console.log('[Auth] Login response', res.status);
      if (!res.ok) return false;
      const data = await res.json();
      console.log('[Auth] Login success', data);
      setUser({ userId: data.userId, email, isAdmin: false, token: data.token });
      return true;
    } catch (e) {
      console.error('[Auth] Login error', e);
      return false;
    }
  };

  const register = async (email: string, password: string): Promise<boolean> => {
    try {
      const url = `${API_URL}/auth/register`;
      console.log('[Auth] Register POST', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pwd: password }),
      });
      console.log('[Auth] Register response', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.log('[Auth] Register error', err);
        return false;
      }
      const data = await res.json();
      console.log('[Auth] Register success', data);
      setPendingVerifyUrl(data.verifyUrl ?? null);
      //setUser({ userId: data.userId, email, isAdmin: false, token: data.token });
      return true;
    } catch (e) {
      console.error('[Auth] Register error', e);
      return false;
    }
  };

  const verifyEmail = async (): Promise<boolean> => {
    if (!pendingVerifyUrl) return false;
    try {
      const res = await fetch(pendingVerifyUrl);
      if (!res.ok) return false;
      setPendingVerifyUrl(null);
      return true;
    } catch (e) {
      console.error('[Auth] Verify error', e);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
  };

  const setTestUser = () => {
    setUser({
      userId: 999,
      email: 'test@test.com',
      isAdmin: false,
    });
  };

  const fetchBookmarks = async (): Promise<any[]> => {
    if (!user?.token) return [];
    try {
      const res = await fetch(`${API_URL}/bookmarks`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[Bookmarks] Fetch error', e);
      return [];
    }
  };

  const createBookmark = async (name: string, locations: any[]): Promise<boolean> => {
    if (!user?.token) return false;
    try {
      const res = await fetch(`${API_URL}/bookmarks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, locations }),
      });
      return res.ok;
    } catch (e) {
      console.error('[Bookmarks] Create error', e);
      return false;
    }
  };

  const deleteBookmark = async (id: string): Promise<boolean> => {
    if (!user?.token) return false;
    try {
      const res = await fetch(`${API_URL}/bookmarks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      return res.ok;
    } catch (e) {
      console.error('[Bookmarks] Delete error', e);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, pendingVerifyUrl, login, register, verifyEmail, logout, setTestUser, fetchBookmarks, createBookmark, deleteBookmark, activeBookmarkLocations, setActiveBookmarkLocations }}>
      {children}
    </AuthContext.Provider>
  );
}
