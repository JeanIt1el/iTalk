import type { CEFRLevel } from './user';

export interface GrammarExample {
  english: string;
  french: string;
}

export type GrammarExerciseType = 'multiple_choice' | 'fill_blank' | 'rephrase';

export interface GrammarExercise {
  id: string;
  type: GrammarExerciseType;
  prompt: string;
  options?: string[];
}

export interface GrammarExerciseFeedback {
  exerciseId: string;
  correct: boolean;
  answer: string;
  explanation: string;
}

export interface GrammarTopic {
  id: string;
  title: string;
  durationMinutes: number;
  formula: string;
  rule: string;
  explanation: string;
  examples: GrammarExample[];
  exceptions: string[];
  exercises: GrammarExercise[];
  category?: string;
}

export interface GrammarCategory {
  id: string;
  title: string;
  topics: GrammarTopic[];
}

export interface GrammarRoadmap {
  level: CEFRLevel;
  title: string;
  description: string;
  categories: GrammarCategory[];
}

export interface GrammarEnrichment {
  topicId: string;
  category: string;
  explanation: string;
  exercises: Array<{
    question: string;
    answer: string;
    explanation: string;
  }>;
}