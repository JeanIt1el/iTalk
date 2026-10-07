import { create } from 'zustand';
import type { UserProfile } from '@/types/user';
import { mockUser } from '@/data/mock-user';

interface AuthStore {
  user: UserProfile | null;
  isAuthenticated: boolean;
  token: string | null;
  setUser: (user: UserProfile | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: mockUser,
  isAuthenticated: true,
  token: 'mock-jwt-token',
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  logout: () => set({ user: null, isAuthenticated: false, token: null }),
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));
