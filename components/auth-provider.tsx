import React, { useState } from 'react';
import { AuthContext, AuthUser, TEST_USER } from '@/hooks/use-auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (email: string, password: string): boolean => {
    if (email === TEST_USER.email && password === TEST_USER.password) {
      setUser({
        userId: TEST_USER.userId,
        email: TEST_USER.email,
        isAdmin: TEST_USER.isAdmin,
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
