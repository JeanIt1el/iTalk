import type { AuthState, OnboardingData, UserProfile } from '@/types/user';
import type { ApiResponse } from '@/types/api';
import { delay } from './api-client';
import { mockUser } from '@/data/mock-user';

/**
 * Mock authentication service.
 * Will be replaced by FastAPI auth endpoints (JWT-based).
 */

export const authService = {
  async login(email: string, _password: string): Promise<AuthState> {
    await delay(500);
    return {
      user: { ...mockUser, email },
      isAuthenticated: true,
      token: 'mock-jwt-token',
    };
  },

  async register(name: string, email: string, _password: string): Promise<AuthState> {
    await delay(600);
    return {
      user: { ...mockUser, name, email },
      isAuthenticated: true,
      token: 'mock-jwt-token',
    };
  },

  async logout(): Promise<ApiResponse<null>> {
    await delay(200);
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
    await delay(200);
    return 'mock-jwt-token-refreshed';
  },
};
