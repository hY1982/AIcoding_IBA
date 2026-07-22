import { useState, useCallback, useEffect } from 'react';

/**
 * 认证用户信息
 */
export interface AuthUser {
  id: number;
  phone: string;
  nickname: string;
  userType: string;
  avatarUrl?: string;
  status: string;
  regionCode?: string;
}

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

/**
 * 认证状态 Hook
 *
 * 管理登录状态、用户信息、token 的读写。
 * Token 持久化存储在 localStorage 中，使用 admin_ 前缀避免与移动端冲突。
 */
export function useAuth() {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    try {
      return stored ? (JSON.parse(stored) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!localStorage.getItem(TOKEN_KEY);
  });

  /**
   * 登录成功后的处理
   */
  const login = useCallback((newToken: string, authUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    setToken(newToken);
    setUser(authUser);
    setIsAuthenticated(true);
  }, []);

  /**
   * 登出处理
   */
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  /**
   * 同步其他标签页的登录状态变化
   */
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) {
        const newToken = e.newValue;
        setToken(newToken);
        setIsAuthenticated(!!newToken);
        if (!newToken) {
          setUser(null);
        }
      }
      if (e.key === USER_KEY) {
        try {
          setUser(e.newValue ? (JSON.parse(e.newValue) as AuthUser) : null);
        } catch {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    token,
    user,
    isAuthenticated,
    login,
    logout,
  };
}
