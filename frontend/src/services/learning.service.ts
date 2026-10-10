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
import { apiGet, apiPatch, apiPost, delay } from './api-client';
import {
  mockModules,
  mockLessons,
  mockVocabularyCollections,
  mockGrammarResult,
} from '@/data/mock-learning';

function responseArray<T>(response: unknown, property?: string): T[] {
  let value = response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (Array.isArray(value)) return value as T[];
    if (!value || typeof value !== 'object') return [];

    const record = value as Record<string, unknown>;
    if (property && property in record) {
      value = record[property];
    } else if ('data' in record) {
      value = record.data;
    } else {
      return [];
    }
  }
  return Array.isArray(value) ? value as T[] : [];
}

export const learningService = {
  async startSession(input: {
    moduleType: SkillType;
    scenario?: string;
    title?: string;
    description?: string;
    level?: CEFRLevel;
  }): Promise<{ id: string; startedAt: string }> {
    const session = await apiPost<Record<string, unknown>>('/learning/sessions', {
      module_type: input.moduleType,
      scenario: input.scenario,
      title: input.title,
      description: input.description,
      level: input.level ?? 'B1',
    });
    return { id: String(session.id), startedAt: String(session.started_at) };
  },

  async completeSession(sessionId: string, durationSeconds: number, score?: number): Promise<void> {
    await apiPatch(`/learning/sessions/${sessionId}/complete`, {
      duration_seconds: durationSeconds,
      score,
    });
  },

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
    let response: unknown;
    try {
      response = await apiGet<unknown>('/learning/modules');
    } catch {
      return { modules: [], total: 0 };
    }

    let result = responseArray<Record<string, unknown>>(response, 'modules').map((module) => ({
      id: String(module.id),
      title: String(module.title),
      description: String(module.description),
      category: module.category as LearningModule['category'],
      skill: module.skill as SkillType,
      level: module.level as CEFRLevel,
      topic: String(module.topic),
      durationMinutes: Number(module.duration_minutes),
      difficulty: module.difficulty as LearningModule['difficulty'],
      thumbnailColor: String(module.thumbnail_color),
      lessonsCount: Number(module.lessons_count),
      completedLessons: Number(module.completed_lessons),
      progress: Number(module.progress),
      isLocked: Boolean(module.is_locked),
    }));

    if (filters?.level) result = result.filter((module) => module.level === filters.level);
    if (filters?.skill) result = result.filter((module) => module.skill === filters.skill);
    if (filters?.topic) result = result.filter((module) => module.topic === filters.topic);
    if (filters?.maxDuration) result = result.filter((module) => module.durationMinutes <= filters.maxDuration!);
    if (filters?.category) result = result.filter((module) => module.category === filters.category);
    if (filters?.difficulty) result = result.filter((module) => module.difficulty === filters.difficulty);
    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter((module) =>
        module.title.toLowerCase().includes(search) || module.description.toLowerCase().includes(search),
      );
    }

    let record = response && typeof response === 'object' ? response as Record<string, unknown> : {};
    for (let attempt = 0; attempt < 3 && 'data' in record && !('modules' in record); attempt += 1) {
      const nested = record.data;
      record = nested && typeof nested === 'object' ? nested as Record<string, unknown> : {};
    }
    const total = typeof record.total === 'number' ? record.total : result.length;
    return { modules: result, total };
  },

  async getModuleById(id: string): Promise<LearningModule | null> {
    await delay();
    return mockModules.find((module) => module.id === id) ?? null;
  },

  async getLessons(moduleId: string): Promise<Lesson[]> {
    await delay();
    return mockLessons.filter((lesson) => lesson.moduleId === moduleId);
  },

  async getVocabularyCollections(): Promise<VocabularyCollection[]> {
    await delay();
    return mockVocabularyCollections;
  },

  async getVocabularyItems(collectionId?: string): Promise<VocabularyItem[]> {
    let response: unknown;
    try {
      response = await apiGet<unknown>('/vocabulary/items');
    } catch {
      return [];
    }
    return responseArray<Record<string, unknown>>(response).map((item) => ({
      id: String(item.id),
      word: String(item.word),
      translation: String(item.translation),
      language: String(item.language ?? 'fr'),
      phonetic: String(item.phonetic ?? ''),
      partOfSpeech: String(item.part_of_speech ?? ''),
      example: String(item.example ?? ''),
      exampleTranslation: String(item.example_translation ?? ''),
      level: item.level as VocabularyItem['level'],
      collection: String(item.collection ?? 'personal'),
      srsLevel: Number(item.srs_level),
      nextReview: String(item.next_review),
      lastReviewed: item.last_reviewed ? String(item.last_reviewed) : null,
    })).filter((item) => !collectionId || item.collection === collectionId);
  },

  async reviewVocabularyItem(itemId: string, rating: SrsRating): Promise<VocabularyItem> {
    const result = await apiPatch<Record<string, unknown>>(
      `/vocabulary/items/${itemId}/review`,
      undefined,
      { params: { rating } },
    );
    const items = await this.getVocabularyItems();
    const item = items.find((value) => value.id === itemId);
    if (!item) throw new Error('Vocabulary item not found');
    return {
      ...item,
      srsLevel: Number(result.srs_level),
      lastReviewed: new Date().toISOString(),
      nextReview: String(result.next_review),
    };
  },

  async getReadingTexts(level?: CEFRLevel): Promise<ReadingText[]> {
    let response: unknown;
    try {
      response = await apiGet<unknown>('/reading/contents');
    } catch {
      return [];
    }
    return responseArray<Record<string, unknown>>(response).map((text) => ({
      id: String(text.id),
      title: String(text.title),
      author: String(text.author ?? ''),
      level: text.level as ReadingText['level'],
      content: String(text.content),
      wordCount: Number(text.word_count),
      estimatedReadingTime: Number(text.estimated_reading_time),
      topic: String(text.topic),
      difficultWords: (text.difficult_words as ReadingText['difficultWords']) ?? [],
      audioUrl: text.audio_url ? String(text.audio_url) : null,
    })).filter((text) => !level || text.level === level);
  },

  async getReadingText(id: string): Promise<ReadingText | null> {
    const texts = await this.getReadingTexts();
    return texts.find((text) => text.id === id) ?? null;
  },

  async updateReadingProgress(progress: ReadingProgress): Promise<ReadingProgress> {
    await apiPatch('/learning/reading/progress', {
      text_id: progress.textId,
      progress: progress.progress,
      time_spent: progress.timeSpent,
      words_read: progress.wordsRead,
      is_completed: progress.isCompleted,
    });
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