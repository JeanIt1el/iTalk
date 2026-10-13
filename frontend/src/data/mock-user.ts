import type { UserProfile, UserPreferences } from '@/types/user';

export const mockUserPreferences: UserPreferences = {
  showTranslations: true,
  autoPlayAudio: false,
  reducedMotion: false,
  notifications: {
    dailyReminder: true,
    streakAlerts: true,
    achievementAlerts: true,
  },
  privacy: {
    shareProgress: true,
    publicProfile: false,
  },
};

export const mockUser: UserProfile = {
  id: 'user-001',
  name: 'Camille Dubois',
  email: 'camille.dubois@example.com',
  avatarUrl: null,
  interfaceLanguage: 'fr',
  targetLanguage: 'en',
  cefrLevel: 'B1',
  goals: ['travel', 'work', 'daily'],
  interests: ['Voyage', 'Culture', 'Technologie', 'Cinéma', 'Musique'],
  pace: 'regular',
  dailyGoalMinutes: 20,
  streakDays: 12,
  totalMinutesStudied: 1840,
  joinedAt: '2025-06-01T10:00:00Z',
  preferences: mockUserPreferences,
};
