import type { CEFRLevel } from './user';

export type VocabularyRating = 'again' | 'hard' | 'good' | 'easy';
export type VocabularyQuizQuestionType =
  | 'multiple_choice'
  | 'write_word'
  | 'fill_blank'
  | 'synonym'
  | 'translation_match'
  | 'scramble'
  | 'odd_one_out';
export type VocabularyRegister = 'familiar' | 'neutral' | 'formal' | 'academic';

export interface VocabularySynonym {
  word: string;
  register: VocabularyRegister;
  nuanceFr: string;
}

export interface VocabularyWord {
  slug: string;
  word: string;
  translationFr: string;
  additionalMeanings: string[];
  partOfSpeech: string;
  cefrLevel: CEFRLevel;
  ipa: string | null;
  exampleEn: string;
  exampleFr: string;
  usageNoteFr: string | null;
  synonyms: string[];
  synonymDetails: VocabularySynonym[];
  antonyms: string[];
  collocations: string[];
  tags: string[];
  sourceType: 'seeded' | 'ai_generated';
  masteryLevel: number;
  nextReviewAt: string | null;
  isFavorite: boolean;
}

export interface VocabularyCollection {
  slug: string;
  title: string;
  description: string;
  icon: string;
  cefrLevel: CEFRLevel;
  wordCount: number;
  masteredCount: number;
}

export interface VocabularyWordPage {
  items: VocabularyWord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VocabularyProgress {
  studiedCount: number;
  masteredCount: number;
  dueCount: number;
  favoriteCount: number;
  successes: number;
  failures: number;
}

export interface VocabularyReviewResult {
  itemSlug: string;
  rating: VocabularyRating;
  masteryLevel: number;
  nextReviewAt: string;
  duplicate: boolean;
}

export interface VocabularyQuizQuestion {
  index: number;
  type: VocabularyQuizQuestionType;
  prompt: string;
  options: string[];
}

export interface VocabularyQuiz {
  id: string;
  questions: VocabularyQuizQuestion[];
  answeredCount: number;
  status: 'active' | 'completed' | 'abandoned';
  score: number | null;
  startedAt: string;
  timeLimitSeconds: 60 | 120 | null;
}

export interface VocabularyQuizHistoryItem {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  score: number | null;
  answeredCount: number;
  questionCount: number;
  startedAt: string;
  finishedAt: string | null;
  timeLimitSeconds: 60 | 120 | null;
}

export interface VocabularyQuizFeedback {
  questionIndex: number;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
}

export interface VocabularyScenario {
  slug: string;
  title: string;
  description: string;
  cefrLevel: CEFRLevel;
  learningObjective: string;
  situation: string;
  usefulPhrases: string[];
  words: VocabularyWord[];
}

export interface GeneratedVocabularyWord {
  word: string;
  translationFr: string;
  partOfSpeech: string;
  cefrLevel: CEFRLevel;
  ipa: string;
  exampleEn: string;
  exampleFr: string;
  usageNoteFr: string;
  synonyms: string[];
  tags: string[];
  sourceType: 'ai_generated' | 'catalog_fallback';
}

export interface SavedGeneratedVocabularyWord extends GeneratedVocabularyWord {
  id: string;
  createdAt: string;
  sourceType: 'ai_generated';
}

export interface VocabularyExplanation {
  explanationFr: string;
  examples: string[];
  commonMistakeFr: string;
  sourceType: 'groq' | 'catalog_fallback';
}