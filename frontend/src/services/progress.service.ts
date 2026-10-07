import type {
  ProgressOverview,
  StreakData,
  SkillScore,
  Recommendation,
  DailyActivity,
} from '@/types/learning';
import { delay } from './api-client';
import {
  mockProgressOverview,
  mockStreakData,
  mockSkillScores,
  mockRecommendations,
  mockWeeklyActivity,
} from '@/data/mock-progress';

/**
 * Mock progress service.
 * Will be replaced by FastAPI progress/analytics endpoints.
 */

export const progressService = {
  async getOverview(): Promise<ProgressOverview> {
    await delay();
    return mockProgressOverview;
  },

  async getStreak(): Promise<StreakData> {
    await delay();
    return mockStreakData;
  },

  async getSkillScores(): Promise<SkillScore[]> {
    await delay();
    return mockSkillScores;
  },

  async getRecommendations(): Promise<Recommendation[]> {
    await delay();
    return mockRecommendations;
  },

  async getWeeklyActivity(): Promise<DailyActivity[]> {
    await delay();
    return mockWeeklyActivity;
  },

  async getMonthlyActivity(): Promise<DailyActivity[]> {
    await delay(500);
    return mockWeeklyActivity;
  },
};
