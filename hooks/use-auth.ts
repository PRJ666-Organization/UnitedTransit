import React, { createContext, useCallback, useContext, useState } from 'react';

export type AuthUser = {
  userId: number;
  email: string;
  isAdmin: boolean;
  token?: string;
};

export type BookmarkLocation = {
  latitude: number;
  longitude: number;
  name?: string;
};

export type AuthContextType = {
  user: AuthUser | null;
  pendingVerifyUrl: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  verifyEmail: () => Promise<boolean>;
  logout: () => void;
  setTestUser: () => void;
  fetchBookmarks: () => Promise<any[]>;
  createBookmark: (name: string, locations: any[]) => Promise<boolean>;
  deleteBookmark: (id: string) => Promise<boolean>;
  activeBookmarkLocations: BookmarkLocation[];
  setActiveBookmarkLocations: (locs: BookmarkLocation[]) => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
