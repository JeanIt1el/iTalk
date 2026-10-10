import { create } from 'zustand';
import type { UserProfile } from '@/types/user';
import { mockUser } from '@/data/mock-user';
import { supabase } from '@/lib/supabase';

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
  isAuthenticated: false,
  token: null,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  logout: () => {
    if (supabase) void supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, token: null });
  },
  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),
}));
