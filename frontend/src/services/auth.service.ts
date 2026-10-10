import type { AuthState, OnboardingData, UserProfile } from '@/types/user';
import type { ApiResponse } from '@/types/api';
import { delay } from './api-client';
import { mockUser } from '@/data/mock-user';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * Mock authentication service.
 * Will be replaced by FastAPI auth endpoints (JWT-based).
 */

export const authService = {
  async login(email: string, password: string): Promise<AuthState> {
    if (!supabase) throw new Error('Supabase Auth is not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Supabase did not return an active session');

    const user: UserProfile = {
      ...mockUser,
      id: data.user.id,
      name: data.user.user_metadata.full_name ?? email,
      email,
    };
    const authState = { user, isAuthenticated: true, token: data.session.access_token };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setToken(authState.token);
    return authState;
  },

  async register(name: string, email: string, password: string): Promise<AuthState> {
    if (!supabase) throw new Error('Supabase Auth is not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw error;

    const user: UserProfile = { ...mockUser, id: data.user?.id ?? '', name, email };
    const token = data.session?.access_token ?? null;
    useAuthStore.getState().setUser(data.session ? user : null);
    useAuthStore.getState().setToken(token);
    return { user: data.session ? user : null, isAuthenticated: !!data.session, token };
  },

  async logout(): Promise<ApiResponse<null>> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    useAuthStore.getState().logout();
    return { data: null, success: true, message: 'Déconnexion réussie' };
  },

  async getProfile(): Promise<UserProfile> {
    await delay(300);
    return mockUser;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    await delay(400);
    return { ...mockUser, ...updates };
  },

  async completeOnboarding(data: OnboardingData): Promise<UserProfile> {
    await delay(600);
    return {
      ...mockUser,
      name: data.name,
      interfaceLanguage: data.interfaceLanguage,
      targetLanguage: data.targetLanguage,
      cefrLevel: data.cefrLevel,
      goals: data.goals,
      interests: data.interests,
      pace: data.pace,
      dailyGoalMinutes: data.dailyGoalMinutes,
    };
  },

  async refreshToken(): Promise<string> {
    if (!supabase) throw new Error('Supabase Auth is not configured');
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    const token = data.session?.access_token;
    if (!token) throw new Error('No active Supabase session');
    useAuthStore.getState().setToken(token);
    return token;
  },
};
