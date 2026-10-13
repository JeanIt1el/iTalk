import type {
  ProgressOverview,
  StreakData,
  SkillScore,
  Recommendation,
  DailyActivity,
} from '@/types/learning';

const today = new Date();
function dateOffset(days: number): string {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

export const mockWeeklyActivity: DailyActivity[] = [
  { date: dateOffset(6), minutes: 25, lessonsCompleted: 2, skill: 'conversation' },
  { date: dateOffset(5), minutes: 0, lessonsCompleted: 0, skill: 'conversation' },
  { date: dateOffset(4), minutes: 30, lessonsCompleted: 3, skill: 'grammar' },
  { date: dateOffset(3), minutes: 20, lessonsCompleted: 2, skill: 'vocabulary' },
  { date: dateOffset(1), minutes: 35, lessonsCompleted: 3, skill: 'speaking' },
  { date: dateOffset(0), minutes: 22, lessonsCompleted: 2, skill: 'conversation' },
];

export const mockStreakData: StreakData = {
  currentStreak: 12,
  longestStreak: 23,
  weeklyActivity: mockWeeklyActivity,
  monthlyActivity: mockWeeklyActivity,
};

export const mockSkillScores: SkillScore[] = [
  { skill: 'conversation', score: 74, level: 'B1', progress: 68, trend: 'up' },
  { skill: 'grammar', score: 65, level: 'B1', progress: 55, trend: 'up' },
  { skill: 'vocabulary', score: 88, level: 'B1', progress: 90, trend: 'up' },
  { skill: 'speaking', score: 58, level: 'A2', progress: 42, trend: 'down' },
  { skill: 'listening', score: 72, level: 'B1', progress: 60, trend: 'stable' },
];

export const mockRecommendations: Recommendation[] = [
  {
    id: 'rec-001',
    title: 'Pratiquez la prise de parole',
    reason: 'Votre score en expression orale a baissé cette semaine.',
    skill: 'speaking',
    level: 'B1',
    estimatedDuration: 10,
    priority: 'high',
  },
  {
    id: 'rec-002',
    title: 'Révisez les temps du passé',
    reason: 'Des erreurs récurrentes ont été détectées en grammaire.',
    skill: 'grammar',
    level: 'B1',
    estimatedDuration: 15,
    priority: 'medium',
  },
];

export const mockProgressOverview: ProgressOverview = {
  totalMinutes: 1840,
  totalLessons: 48,
  currentStreak: 12,
  longestStreak: 23,
  weeklyMinutes: 147,
  weeklyGoal: 140,
  skillScores: mockSkillScores,
  cefrProgression: [
    { date: '2025-06', level: 'A2', score: 55 },
    { date: '2025-07', level: 'A2', score: 68 },
    { date: '2025-08', level: 'B1', score: 72 },
    { date: '2025-09', level: 'B1', score: 78 },
  ],
  recentActivities: [
    { id: 'act-001', type: 'conversation', title: 'Conversation au restaurant', duration: 12, date: dateOffset(0), score: 76 },
    { id: 'act-002', type: 'vocabulary', title: 'Vocabulaire : Voyages', duration: 10, date: dateOffset(0), score: 90 },
    { id: 'act-003', type: 'grammar', title: 'Les temps du passé', duration: 20, date: dateOffset(1), score: 65 },
    { id: 'act-005', type: 'speaking', title: 'Se présenter', duration: 8, date: dateOffset(3), score: 58 },
  ],
  recommendations: mockRecommendations,
};
