import { create } from 'zustand';

interface User {
  id: number;
  nickname: string;
  userType: 'player' | 'venue_manager';
}

interface AppState {
  token: string | null;
  user: User | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: null,
  user: null,
  setToken: (token) => set({ token }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ token: null, user: null }),
}));

export default useAppStore;
