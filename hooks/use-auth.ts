import React, { createContext, useContext, useState } from 'react';

export type AuthUser = {
  userId: number;
  email: string;
  isAdmin: boolean;
};

export type AuthContextType = {
  user: AuthUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const TEST_USER = {
  email: 'test@test.com',
  password: 'password123',
  userId: 1,
  isAdmin: false,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
