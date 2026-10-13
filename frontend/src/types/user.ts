export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type InterfaceLanguage = 'fr' | 'en' | 'es' | 'de';

export type TargetLanguage = 'en' | 'es' | 'de' | 'it' | 'pt' | 'zh' | 'ja';

export type LearningGoal =
  | 'travel'
  | 'work'
  | 'study'
  | 'daily'
  | 'exam'
  | 'culture';

export type LearningPace = 'casual' | 'regular' | 'intensive';

export type ThemePreference = 'light' | 'dark' | 'system';

export type SkillType = 'conversation' | 'grammar' | 'vocabulary' | 'speaking' | 'listening';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  interfaceLanguage: InterfaceLanguage;
  targetLanguage: TargetLanguage;
  cefrLevel: CEFRLevel;
  goals: LearningGoal[];
  interests: string[];
  pace: LearningPace;
  dailyGoalMinutes: number;
  streakDays: number;
  totalMinutesStudied: number;
  joinedAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  showTranslations: boolean;
  autoPlayAudio: boolean;
  reducedMotion: boolean;
  notifications: {
    dailyReminder: boolean;
    streakAlerts: boolean;
    achievementAlerts: boolean;
  };
  privacy: {
    shareProgress: boolean;
    publicProfile: boolean;
  };
}

export interface OnboardingData {
  name: string;
  interfaceLanguage: InterfaceLanguage;
  targetLanguage: TargetLanguage;
  cefrLevel: CEFRLevel;
  goals: LearningGoal[];
  interests: string[];
  pace: LearningPace;
  dailyGoalMinutes: number;
}

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  token: string | null;
}
