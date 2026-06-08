import React, { useState, useCallback, useEffect } from 'react';
import { AuthContext, AuthUser, BookmarkLocation, SearchHistoryItem } from '@/hooks/use-auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const DEVICE_ID_KEY = 'united_transit_device_id';
const SEARCH_HISTORY_KEY = 'search_history_anonymous';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pendingVerifyUrl, setPendingVerifyUrl] = useState<string | null>(null);
  const [activeBookmarkLocations, setActiveBookmarkLocations] = useState<BookmarkLocation[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Generate or retrieve device ID on mount
  useEffect(() => {
    const initDeviceId = async () => {
      try {
        let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!storedId) {
          storedId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
        }
        setDeviceId(storedId);
      } catch (e) {
        console.error('[DeviceId] Error:', e);
        setDeviceId(`device_${Date.now()}`);
      }
    };
    initDeviceId();
  }, []);

  const getDeviceId = useCallback(async (): Promise<string> => {
    if (deviceId) return deviceId;
    try {
      let storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!storedId) {
        storedId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(DEVICE_ID_KEY, storedId);
      }
      setDeviceId(storedId);
      return storedId;
    } catch {
      return `device_${Date.now()}`;
    }
  }, [deviceId]);

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

  const fetchSearchHistory = useCallback(async (): Promise<SearchHistoryItem[]> => {
    try {
      if (user?.token) {
        // Authenticated user - fetch from server
        const res = await fetch(`${API_URL}/search-history`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) return [];
        return await res.json();
      } else {
        // Anonymous user - fetch from AsyncStorage
        const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
      }
    } catch (e) {
      console.error('[SearchHistory] Fetch error', e);
      return [];
    }
  }, [user?.token]);

  const saveSearchHistory = useCallback(async (locations: BookmarkLocation[]): Promise<boolean> => {
    try {
      if (user?.token) {
        // Authenticated user - save to server
        const res = await fetch(`${API_URL}/search-history`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ locations }),
        });
        return res.ok;
      } else {
        // Anonymous user - save to AsyncStorage
        const stored = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
        const history: SearchHistoryItem[] = stored ? JSON.parse(stored) : [];

        // Add new entry at beginning
        history.unshift({
          search_id: Date.now(),
          locations_json: JSON.stringify(locations),
          searched_at: new Date().toISOString(),
        });

        // Keep only last 3
        const trimmed = history.slice(0, 3);
        await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
        return true;
      }
    } catch (e) {
      console.error('[SearchHistory] Save error', e);
      return false;
    }
  }, [user?.token]);

  return (
    <AuthContext.Provider value={{
      user,
      pendingVerifyUrl,
      login,
      register,
      verifyEmail,
      logout,
      setTestUser,
      fetchBookmarks,
      createBookmark,
      deleteBookmark,
      activeBookmarkLocations,
      setActiveBookmarkLocations,
      fetchSearchHistory,
      saveSearchHistory,
      getDeviceId,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
