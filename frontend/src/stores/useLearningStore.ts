import { create } from 'zustand';
import type { CEFRLevel, TargetLanguage } from '@/types/user';

interface LearningStore {
  targetLanguage: TargetLanguage;
  cefrLevel: CEFRLevel;
  dailyGoalMinutes: number;
  showTranslations: boolean;
  textSize: 'small' | 'medium' | 'large';
  setTargetLanguage: (lang: TargetLanguage) => void;
  setCefrLevel: (level: CEFRLevel) => void;
  setDailyGoalMinutes: (min: number) => void;
  setShowTranslations: (show: boolean) => void;
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
}

export const useLearningStore = create<LearningStore>((set) => ({
  targetLanguage: 'en',
  cefrLevel: 'B1',
  dailyGoalMinutes: 20,
  showTranslations: true,
  textSize: 'medium',
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setCefrLevel: (level) => set({ cefrLevel: level }),
  setDailyGoalMinutes: (min) => set({ dailyGoalMinutes: min }),
  setShowTranslations: (show) => set({ showTranslations: show }),
  setTextSize: (size) => set({ textSize: size }),
}));
