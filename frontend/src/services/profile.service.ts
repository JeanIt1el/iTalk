import type { UserProfile, UserPreferences, ThemePreference } from '@/types/user';
import { delay } from './api-client';
import { mockUser } from '@/data/mock-user';

/**
 * Mock profile service.
 * Will be replaced by FastAPI profile endpoints.
 */

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    await delay();
    return mockUser;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    await delay(400);
    return { ...mockUser, ...updates };
  },

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    await delay(300);
    return { ...mockUser.preferences, ...updates };
  },

  async updateTheme(theme: ThemePreference): Promise<ThemePreference> {
    await delay(100);
    return theme;
  },

  async deleteAccount(): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async exportData(): Promise<{ url: string }> {
    await delay(500);
    return { url: 'mock://export.json' };
  },
};
