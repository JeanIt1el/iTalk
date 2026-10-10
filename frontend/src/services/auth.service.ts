import type { AuthState, OnboardingData, UserProfile } from '@/types/user';
import type { ApiResponse } from '@/types/api';
import type { User } from '@supabase/supabase-js';
import { delay } from './api-client';
import { mockUser } from '@/data/mock-user';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/useAuthStore';

export function mapSupabaseUser(user: User): UserProfile {
  const fullName = user.user_metadata.full_name;
  return {
    ...mockUser,
    id: user.id,
    name: typeof fullName === 'string' && fullName.trim()
      ? fullName
      : user.email?.split('@')[0] ?? 'Apprenant',
    email: user.email ?? '',
  };
}

async function ensureProfile(user: User, fullName?: string): Promise<void> {
  if (!supabase) return;
  const name = fullName?.trim()
    || (typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '')
    || user.email?.split('@')[0]
    || 'Apprenant';
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      full_name: name,
      native_language: 'fr',
      target_language: 'en',
      level: 'A1',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

let initializationPromise: Promise<void> | null = null;

export const authService = {
  initialize(): Promise<void> {
    if (initializationPromise) return initializationPromise;
    initializationPromise = (async () => {
      if (!supabase) {
        useAuthStore.getState().setSession(null, null);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        let session = data.session;

        const devEmail = import.meta.env.VITE_DEV_AUTH_EMAIL;
        const devPassword = import.meta.env.VITE_DEV_AUTH_PASSWORD;
        if (!session && import.meta.env.DEV && devEmail && devPassword) {
          const result = await supabase.auth.signInWithPassword({
            email: devEmail,
            password: devPassword,
          });
          if (result.error) throw result.error;
          session = result.data.session;
        }

        useAuthStore.getState().setSession(
          session?.user ? mapSupabaseUser(session.user) : null,
          session?.access_token ?? null,
        );
      } catch {
        useAuthStore.getState().setSession(null, null);
      }
    })();
    return initializationPromise;
  },

  async login(email: string, password: string): Promise<AuthState> {
    if (!supabase) throw new Error('Supabase Auth is not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('Supabase did not return an active session');

    await ensureProfile(data.user);
    const user = mapSupabaseUser(data.user);
    const authState = { user, isAuthenticated: true, token: data.session.access_token };
    useAuthStore.getState().setSession(user, authState.token);
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
    if (data.user && !data.session && data.user.identities?.length === 0) {
      throw new Error('User already registered');
    }

    if (data.user && data.session) await ensureProfile(data.user, name);
    const user = data.user && data.session ? mapSupabaseUser(data.user) : null;
    const token = data.session?.access_token ?? null;
    useAuthStore.getState().setSession(user, token);
    return { user, isAuthenticated: !!data.session, token };
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
