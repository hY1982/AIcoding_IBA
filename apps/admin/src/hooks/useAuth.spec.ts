import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

const TOKEN_KEY = 'admin_token';
const USER_KEY = 'admin_user';

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with no auth state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should initialize from localStorage', () => {
    const mockUser = {
      id: 1,
      phone: '13800138000',
      nickname: 'Admin',
      userType: 'player',
      status: 'active',
    };
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth());

    expect(result.current.token).toBe('test-token');
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('should login and update state', () => {
    const { result } = renderHook(() => useAuth());

    const mockUser = {
      id: 1,
      phone: '13800138000',
      nickname: 'Admin',
      userType: 'player',
      status: 'active',
    };

    act(() => {
      result.current.login('new-token', mockUser);
    });

    expect(result.current.token).toBe('new-token');
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
    expect(localStorage.getItem(USER_KEY)).toBe(JSON.stringify(mockUser));
  });

  it('should logout and clear state', () => {
    const mockUser = {
      id: 1,
      phone: '13800138000',
      nickname: 'Admin',
      userType: 'player',
      status: 'active',
    };
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
  });

  it('should sync with storage events from other tabs', () => {
    const { result } = renderHook(() => useAuth());

    // Simulate login from another tab
    act(() => {
      localStorage.setItem(TOKEN_KEY, 'cross-tab-token');
      localStorage.setItem(USER_KEY, JSON.stringify({ id: 2, nickname: 'Other' }));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: TOKEN_KEY,
          newValue: 'cross-tab-token',
        }),
      );
    });

    expect(result.current.token).toBe('cross-tab-token');
    expect(result.current.isAuthenticated).toBe(true);
  });
});
