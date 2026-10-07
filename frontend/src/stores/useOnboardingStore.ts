import { create } from 'zustand';
import type { OnboardingData } from '@/types/user';

interface OnboardingStore {
  data: Partial<OnboardingData>;
  step: number;
  setStep: (step: number) => void;
  updateData: (updates: Partial<OnboardingData>) => void;
  reset: () => void;
}

const initialData: Partial<OnboardingData> = {
  interfaceLanguage: 'fr',
  targetLanguage: 'en',
  cefrLevel: 'B1',
  pace: 'regular',
  dailyGoalMinutes: 20,
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  data: initialData,
  step: 0,
  setStep: (step) => set({ step }),
  updateData: (updates) =>
    set((state) => ({ data: { ...state.data, ...updates } })),
  reset: () => set({ data: initialData, step: 0 }),
}));
