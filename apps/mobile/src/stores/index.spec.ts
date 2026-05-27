import { useAppStore } from './index';

describe('App Store', () => {
  beforeEach(() => {
    useAppStore.setState({ token: null, user: null });
  });

  it('should have correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it('should update token via setToken', () => {
    useAppStore.getState().setToken('test-token-123');
    expect(useAppStore.getState().token).toBe('test-token-123');
  });

  it('should update user via setUser', () => {
    const mockUser = { id: 1, nickname: 'TestPlayer', userType: 'player' as const };
    useAppStore.getState().setUser(mockUser);
    expect(useAppStore.getState().user).toEqual(mockUser);
  });

  it('should clear auth state via clearAuth', () => {
    useAppStore.getState().setToken('token');
    useAppStore.getState().setUser({ id: 1, nickname: 'Test', userType: 'player' });
    useAppStore.getState().clearAuth();
    expect(useAppStore.getState().token).toBeNull();
    expect(useAppStore.getState().user).toBeNull();
  });
});
