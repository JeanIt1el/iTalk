import type {
  LearningModule,
  Lesson,
  VocabularyItem,
  VocabularyCollection,
  GrammarResult,
  ReadingText,
  ReadingProgress,
  SrsRating,
} from '@/types/learning';
import type { CEFRLevel, SkillType } from '@/types/user';
import { delay } from './api-client';
import {
  mockModules,
  mockLessons,
  mockVocabularyCollections,
  mockVocabularyItems,
  mockReadingTexts,
  mockGrammarResult,
} from '@/data/mock-learning';

/**
 * Mock learning service.
 * Will be replaced by FastAPI learning endpoints.
 */

export const learningService = {
  async getModules(filters?: {
    level?: CEFRLevel;
    skill?: SkillType;
    topic?: string;
    maxDuration?: number;
  category?: string;
  search?: string;
  difficulty?: string;
  page?: number;
    pageSize?: number;
  sortBy?: 'title' | 'duration' | 'progress' | 'difficulty';
  sortDir?: 'asc' | 'desc';
  onlyUnlocked?: boolean;
    onlyInProgress?: boolean;
    onlyCompleted?: boolean;
    onlyNotStarted?: boolean;
    onlyBookmarked?: boolean;
    onlyRecommended?: boolean;
    onlyNew?: boolean;
    onlyPopular?: boolean;
    onlyTrending?: boolean;
    onlyFeatured?: boolean;
    onlyFree?: boolean;
    onlyPremium?: boolean;
    onlyArchived?: boolean;
    onlyPublished?: boolean;
    onlyDraft?: boolean;
    onlyDeleted?: boolean;
  }): Promise<{ modules: LearningModule[]; total: number }> {
    await delay();
    let result = [...mockModules];

    if (filters?.level) {
      result = result.filter((m) => m.level === filters.level);
    }
    if (filters?.skill) {
      result = result.filter((m) => m.skill === filters.skill);
    }
    if (filters?.topic) {
      result = result.filter((m) => m.topic === filters.topic);
    }
    if (filters?.maxDuration) {
      result = result.filter((m) => m.durationMinutes <= filters.maxDuration!);
    }
    if (filters?.category) {
      result = result.filter((m) => m.category === filters.category);
    }
    if (filters?.difficulty) {
      result = result.filter((m) => m.difficulty === filters.difficulty);
    }
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(search) ||
          m.description.toLowerCase().includes(search),
      );
    }

    return { modules: result, total: result.length };
  },

  async getModuleById(id: string): Promise<LearningModule | null> {
    await delay();
    return mockModules.find((m) => m.id === id) ?? null;
  },

  async getLessons(moduleId: string): Promise<Lesson[]> {
    await delay();
    return mockLessons.filter((l) => l.moduleId === moduleId);
  },

  async getVocabularyCollections(): Promise<VocabularyCollection[]> {
    await delay();
    return mockVocabularyCollections;
  },

  async getVocabularyItems(collectionId?: string): Promise<VocabularyItem[]> {
    await delay();
    if (collectionId) {
      return mockVocabularyItems.filter((v) => v.collection === collectionId);
    }
    return mockVocabularyItems;
  },

  async reviewVocabularyItem(itemId: string, rating: SrsRating): Promise<VocabularyItem> {
    await delay(300);
    const item = mockVocabularyItems.find((v) => v.id === itemId);
    if (!item) throw new Error('Vocabulary item not found');
    const newLevel = rating === 'again' ? 0 : Math.min(item.srsLevel + 1, 5);
    return {
      ...item,
      srsLevel: newLevel,
      lastReviewed: new Date().toISOString(),
      nextReview: new Date(Date.now() + (rating === 'again' ? 60000 : rating === 'easy' ? 86400000 * 7 : 86400000)).toISOString(),
    };
  },

  async getReadingTexts(level?: CEFRLevel): Promise<ReadingText[]> {
    await delay();
    if (level) {
      return mockReadingTexts.filter((t) => t.level === level);
    }
    return mockReadingTexts;
  },

  async getReadingText(id: string): Promise<ReadingText | null> {
    await delay();
    return mockReadingTexts.find((t) => t.id === id) ?? null;
  },

  async updateReadingProgress(progress: ReadingProgress): Promise<ReadingProgress> {
    await delay(200);
    return progress;
  },

  async checkGrammar(text: string): Promise<GrammarResult> {
    await delay(800);
    return { ...mockGrammarResult, originalText: text };
  },

  async getTopics(): Promise<string[]> {
    await delay();
    return ['Voyage', 'Travail', 'Quotidien', 'Culture', 'Études', 'Technologie', 'Santé', 'Loisirs', 'Société', 'Environnement'];
  },
};
