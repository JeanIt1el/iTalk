import type {
  ProgressOverview,
  StreakData,
  SkillScore,
  Recommendation,
  DailyActivity,
} from '@/types/learning';
import { apiGet } from './api-client';

const EMPTY_OVERVIEW: ProgressOverview = {
  totalMinutes: 0,
  totalLessons: 0,
  currentStreak: 0,
  longestStreak: 0,
  weeklyMinutes: 0,
  weeklyGoal: 140,
  skillScores: [],
  cefrProgression: [],
  recentActivities: [],
  recommendations: [],
};

function mapOverview(data: Record<string, unknown>): ProgressOverview {
  return {
    totalMinutes: Number(data.total_minutes),
    totalLessons: Number(data.total_lessons),
    currentStreak: Number(data.current_streak),
    longestStreak: Number(data.longest_streak),
    weeklyMinutes: Number(data.weekly_minutes),
    weeklyGoal: Number(data.weekly_goal),
    skillScores: ((data.skill_scores as Record<string, unknown>[]) ?? []).map((skill) => ({
      skill: skill.skill as SkillScore['skill'],
      score: Number(skill.score),
      level: skill.level as SkillScore['level'],
      progress: Number(skill.progress),
      trend: skill.trend as SkillScore['trend'],
    })),
    cefrProgression: (data.cefr_progression as ProgressOverview['cefrProgression']) ?? [],
    recentActivities: ((data.recent_activities as Record<string, unknown>[]) ?? []).map((activity) => ({
      id: String(activity.id),
      type: activity.type as SkillScore['skill'],
      title: String(activity.title),
      duration: Number(activity.duration),
      date: String(activity.date),
      score: activity.score == null ? undefined : Number(activity.score),
    })),
    recommendations: (data.recommendations as Recommendation[]) ?? [],
  };
}

function toDailyActivities(overview: ProgressOverview, days: number): DailyActivity[] {
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - days + 1);
  return overview.recentActivities
    .filter((activity) => new Date(`${activity.date}T00:00:00`).getTime() >= startDate.getTime())
    .map((activity) => ({
      date: activity.date,
      minutes: Math.floor(activity.duration / 60),
      lessonsCompleted: 1,
      skill: activity.type,
    }));
}

export const progressService = {
  async getOverview(): Promise<ProgressOverview> {
    try {
      const data = await apiGet<Record<string, unknown>>('/progress/overview');
      return data && typeof data === 'object' ? mapOverview(data) : EMPTY_OVERVIEW;
    } catch {
      return EMPTY_OVERVIEW;
    }
  },

  async getStreak(): Promise<StreakData> {
    const overview = await this.getOverview();
    return {
      currentStreak: overview.currentStreak,
      longestStreak: overview.longestStreak,
      weeklyActivity: toDailyActivities(overview, 7),
      monthlyActivity: toDailyActivities(overview, 30),
    };
  },

  async getSkillScores(): Promise<SkillScore[]> {
    return (await this.getOverview()).skillScores;
  },

  async getRecommendations(): Promise<Recommendation[]> {
    return (await this.getOverview()).recommendations;
  },

  async getWeeklyActivity(): Promise<DailyActivity[]> {
    return toDailyActivities(await this.getOverview(), 7);
  },

  async getMonthlyActivity(): Promise<DailyActivity[]> {
    return toDailyActivities(await this.getOverview(), 30);
  },
};
