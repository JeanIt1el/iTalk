import type { CEFRLevel, SkillType } from './user';

export type ModuleCategory = 'conversation' | 'grammar' | 'vocabulary' | 'speaking' | 'listening';

export type ModuleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  category: ModuleCategory;
  skill: SkillType;
  level: CEFRLevel;
  topic: string;
  durationMinutes: number;
  difficulty: ModuleDifficulty;
  thumbnailColor: string;
  lessonsCount: number;
  completedLessons: number;
  progress: number;
  isLocked: boolean;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  durationMinutes: number;
  isCompleted: boolean;
  order: number;
}

export interface VocabularyItem {
  id: string;
  word: string;
  translation: string;
  language: string;
  phonetic: string;
  partOfSpeech: string;
  example: string;
  exampleTranslation: string;
  level: CEFRLevel;
  collection: string;
  srsLevel: number;
  nextReview: string;
  lastReviewed: string | null;
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface VocabularyCollection {
  id: string;
  name: string;
  description: string;
  wordCount: number;
  level: CEFRLevel;
  color: string;
  icon: string;
}

export interface GrammarMistake {
  id: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  category: 'spelling' | 'grammar' | 'punctuation' | 'word_choice' | 'syntax';
  startIndex: number;
  endIndex: number;
}

export interface GrammarResult {
  id: string;
  originalText: string;
  correctedText: string;
  mistakes: GrammarMistake[];
  categoryScores: {
    spelling: number;
    grammar: number;
    punctuation: number;
    word_choice: number;
    syntax: number;
  };
  overallScore: number;
  improvedVersion: string;
  explanation: string;
}

export interface DailyActivity {
  date: string;
  minutes: number;
  lessonsCompleted: number;
  skill: SkillType;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  weeklyActivity: DailyActivity[];
  monthlyActivity: DailyActivity[];
}

export interface SkillScore {
  skill: SkillType;
  score: number;
  level: CEFRLevel;
  progress: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ProgressOverview {
  totalMinutes: number;
  totalLessons: number;
  currentStreak: number;
  longestStreak: number;
  weeklyMinutes: number;
  weeklyGoal: number;
  skillScores: SkillScore[];
  cefrProgression: { date: string; level: CEFRLevel; score: number }[];
  recentActivities: RecentActivity[];
  recommendations: Recommendation[];
}

export interface RecentActivity {
  id: string;
  type: SkillType;
  title: string;
  duration: number;
  date: string;
  score?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  reason: string;
  skill: SkillType;
  level: CEFRLevel;
  estimatedDuration: number;
  priority: 'high' | 'medium' | 'low';
}
