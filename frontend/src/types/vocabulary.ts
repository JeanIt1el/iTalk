import type { CEFRLevel } from './user';

export type VocabularyRating = 'again' | 'hard' | 'good' | 'easy';
export type VocabularyQuizQuestionType = 'multiple_choice' | 'write_word' | 'fill_blank';

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
  sourceType: 'ai_generated';
}

export interface SavedGeneratedVocabularyWord extends GeneratedVocabularyWord {
  id: string;
  createdAt: string;
}

export interface VocabularyExplanation {
  explanationFr: string;
  examples: string[];
  commonMistakeFr: string;
}