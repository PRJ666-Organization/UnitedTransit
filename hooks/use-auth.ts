import React, { createContext, useContext, useState } from 'react';

export type AuthUser = {
  userId: number;
  email: string;
  isAdmin: boolean;
};

export type AuthContextType = {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setTestUser: () => void;
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
