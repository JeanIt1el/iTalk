import type {
  GeneratedVocabularyWord,
  SavedGeneratedVocabularyWord,
  VocabularyCollection,
  VocabularyExplanation,
  VocabularyProgress,
  VocabularyQuiz,
  VocabularyQuizFeedback,
  VocabularyQuizQuestionType,
  VocabularyRating,
  VocabularyReviewResult,
  VocabularyScenario,
  VocabularyWord,
  VocabularyWordPage,
} from '@/types/vocabulary';
import type { CEFRLevel } from '@/types/user';
import { apiDelete, apiGet, apiPost } from './api-client';

interface ApiVocabularyWord extends Omit<
  VocabularyWord,
  | 'translationFr'
  | 'additionalMeanings'
  | 'partOfSpeech'
  | 'cefrLevel'
  | 'exampleEn'
  | 'exampleFr'
  | 'usageNoteFr'
  | 'sourceType'
  | 'masteryLevel'
  | 'nextReviewAt'
  | 'isFavorite'
> {
  translation_fr: string;
  additional_meanings: string[];
  part_of_speech: string;
  cefr_level: CEFRLevel;
  example_en: string;
  example_fr: string;
  usage_note_fr: string | null;
  source_type: 'seeded' | 'ai_generated';
  mastery_level: number;
  next_review_at: string | null;
  is_favorite: boolean;
}

interface ApiCollection extends Omit<VocabularyCollection, 'cefrLevel' | 'wordCount' | 'masteredCount'> {
  cefr_level: CEFRLevel;
  word_count: number;
  mastered_count: number;
}

interface ApiVocabularyQuiz extends Omit<VocabularyQuiz, 'answeredCount'> {
  answered_count: number;
}

interface ApiQuizFeedback extends Omit<VocabularyQuizFeedback, 'questionIndex' | 'isCorrect' | 'correctAnswer'> {
  question_index: number;
  is_correct: boolean;
  correct_answer: string;
}

interface ApiVocabularyScenario extends Omit<VocabularyScenario, 'cefrLevel' | 'learningObjective' | 'usefulPhrases' | 'words'> {
  cefr_level: CEFRLevel;
  learning_objective: string;
  useful_phrases: string[];
  words: ApiVocabularyWord[];
}

interface ApiProgress extends Omit<VocabularyProgress, 'studiedCount' | 'masteredCount' | 'dueCount' | 'favoriteCount'> {
  studied_count: number;
  mastered_count: number;
  due_count: number;
  favorite_count: number;
}

interface ApiGeneratedWord extends Omit<GeneratedVocabularyWord, 'translationFr' | 'partOfSpeech' | 'cefrLevel' | 'exampleEn' | 'exampleFr' | 'usageNoteFr' | 'sourceType'> {
  translation_fr: string;
  part_of_speech: string;
  cefr_level: CEFRLevel;
  example_en: string;
  example_fr: string;
  usage_note_fr: string;
}

interface ApiExplanation extends Omit<VocabularyExplanation, 'explanationFr' | 'commonMistakeFr'> {
  explanation_fr: string;
  common_mistake_fr: string;
}

interface ApiSavedGeneratedWord extends Omit<SavedGeneratedVocabularyWord, 'translationFr' | 'partOfSpeech' | 'cefrLevel' | 'exampleEn' | 'exampleFr' | 'usageNoteFr' | 'createdAt' | 'sourceType'> {
  translation_fr: string;
  part_of_speech: string;
  cefr_level: CEFRLevel;
  example_en: string;
  example_fr: string;
  usage_note_fr: string;
  created_at: string;
  source_type: 'ai_generated';
}

function mapWord(word: ApiVocabularyWord): VocabularyWord {
  const {
    translation_fr,
    additional_meanings,
    part_of_speech,
    cefr_level,
    example_en,
    example_fr,
    usage_note_fr,
    source_type,
    mastery_level,
    next_review_at,
    is_favorite,
    ...rest
  } = word;
  return {
    ...rest,
    translationFr: translation_fr,
    additionalMeanings: additional_meanings,
    partOfSpeech: part_of_speech,
    cefrLevel: cefr_level,
    exampleEn: example_en,
    exampleFr: example_fr,
    usageNoteFr: usage_note_fr,
    sourceType: source_type,
    masteryLevel: mastery_level,
    nextReviewAt: next_review_at,
    isFavorite: is_favorite,
  };
}

function mapCollection(collection: ApiCollection): VocabularyCollection {
  const { cefr_level, word_count, mastered_count, ...rest } = collection;
  return { ...rest, cefrLevel: cefr_level, wordCount: word_count, masteredCount: mastered_count };
}

function mapQuiz(quiz: ApiVocabularyQuiz): VocabularyQuiz {
  const { answered_count, ...rest } = quiz;
  return { ...rest, answeredCount: answered_count };
}

function mapScenario(scenario: ApiVocabularyScenario): VocabularyScenario {
  const { cefr_level, learning_objective, useful_phrases, words, ...rest } = scenario;
  return {
    ...rest,
    cefrLevel: cefr_level,
    learningObjective: learning_objective,
    usefulPhrases: useful_phrases,
    words: words.map(mapWord),
  };
}

export const vocabularyService = {
  async getCollections(filters: { level?: CEFRLevel; q?: string } = {}): Promise<VocabularyCollection[]> {
    const rows = await apiGet<ApiCollection[]>('/vocabulary/collections', { params: filters });
    return rows.map(mapCollection);
  },

  async getWords(filters: {
    q?: string;
    level?: CEFRLevel;
    collectionSlug?: string;
    favoriteOnly?: boolean;
    dueOnly?: boolean;
    page?: number;
    pageSize?: number;
  } = {}): Promise<VocabularyWordPage> {
    const { collectionSlug, favoriteOnly, dueOnly, pageSize, ...query } = filters;
    const response = await apiGet<{
      items: ApiVocabularyWord[];
      total: number;
      page: number;
      page_size: number;
    }>('/vocabulary/words', {
      params: {
        ...query,
        collection_slug: collectionSlug,
        favorite_only: favoriteOnly,
        due_only: dueOnly,
        page_size: pageSize,
      },
    });
    return {
      items: response.items.map(mapWord),
      total: response.total,
      page: response.page,
      pageSize: response.page_size,
    };
  },

  async search(q: string, level?: CEFRLevel): Promise<VocabularyWordPage> {
    const response = await apiGet<{
      items: ApiVocabularyWord[];
      total: number;
      page: number;
      page_size: number;
    }>('/vocabulary/search', { params: { q, level } });
    return { items: response.items.map(mapWord), total: response.total, page: response.page, pageSize: response.page_size };
  },

  async getCollection(slug: string): Promise<VocabularyCollection> {
    return mapCollection(await apiGet<ApiCollection>(`/vocabulary/collections/${slug}`));
  },

  async getCollectionWords(slug: string, page = 1, pageSize = 50): Promise<VocabularyWordPage> {
    const response = await apiGet<{
      items: ApiVocabularyWord[];
      total: number;
      page: number;
      page_size: number;
    }>(`/vocabulary/collections/${slug}/words`, { params: { page, page_size: pageSize } });
    return { items: response.items.map(mapWord), total: response.total, page: response.page, pageSize: response.page_size };
  },

  async getWord(slug: string): Promise<VocabularyWord> {
    return mapWord(await apiGet<ApiVocabularyWord>(`/vocabulary/words/${slug}`));
  },

  async getFavorites(): Promise<VocabularyWord[]> {
    return (await apiGet<ApiVocabularyWord[]>('/vocabulary/favorites')).map(mapWord);
  },

  async setFavorite(slug: string, favorite: boolean): Promise<void> {
    if (favorite) await apiPost<void>(`/vocabulary/favorites/${slug}`);
    else await apiDelete<void>(`/vocabulary/favorites/${slug}`);
  },

  async getDueReviews(): Promise<VocabularyWord[]> {
    return (await apiGet<ApiVocabularyWord[]>('/vocabulary/review/due')).map(mapWord);
  },

  async getProgress(): Promise<VocabularyProgress> {
    const { studied_count, mastered_count, due_count, favorite_count, ...rest } = await apiGet<ApiProgress>('/vocabulary/progress');
    return { ...rest, studiedCount: studied_count, masteredCount: mastered_count, dueCount: due_count, favoriteCount: favorite_count };
  },

  async review(slug: string, rating: VocabularyRating, requestId: string): Promise<VocabularyReviewResult> {
    const result = await apiPost<{
      item_slug: string;
      rating: VocabularyRating;
      mastery_level: number;
      next_review_at: string;
      duplicate: boolean;
    }>('/vocabulary/reviews', { item_slug: slug, rating, request_id: requestId });
    return {
      itemSlug: result.item_slug,
      rating: result.rating,
      masteryLevel: result.mastery_level,
      nextReviewAt: result.next_review_at,
      duplicate: result.duplicate,
    };
  },

  async createQuiz(input: {
    collectionSlug?: string;
    level?: CEFRLevel;
    count?: number;
    questionTypes?: VocabularyQuizQuestionType[];
  }): Promise<VocabularyQuiz> {
    const quiz = await apiPost<ApiVocabularyQuiz>('/vocabulary/quizzes', {
      collection_slug: input.collectionSlug,
      level: input.level,
      count: input.count,
      question_types: input.questionTypes,
    });
    return mapQuiz(quiz);
  },

  async answerQuiz(quizId: string, questionIndex: number, answer: string): Promise<VocabularyQuizFeedback> {
    const response = await apiPost<ApiQuizFeedback>(`/vocabulary/quizzes/${quizId}/answer`, {
      question_index: questionIndex,
      answer,
    });
    return {
      questionIndex: response.question_index,
      isCorrect: response.is_correct,
      correctAnswer: response.correct_answer,
      explanation: response.explanation,
    };
  },

  async finishQuiz(quizId: string): Promise<VocabularyQuiz> {
    return mapQuiz(await apiPost<ApiVocabularyQuiz>(`/vocabulary/quizzes/${quizId}/finish`));
  },

  async getScenarios(level?: CEFRLevel): Promise<VocabularyScenario[]> {
    return (await apiGet<ApiVocabularyScenario[]>('/vocabulary/scenarios', { params: { level } })).map(mapScenario);
  },

  async generateVocabulary(input: { topic: string; level: CEFRLevel; count: number; goal?: string }): Promise<GeneratedVocabularyWord[]> {
    const response = await apiPost<{ source_type: 'ai_generated'; items: ApiGeneratedWord[] }>('/vocabulary/ai/generate', input);
    return response.items.map((item) => ({
      word: item.word,
      translationFr: item.translation_fr,
      partOfSpeech: item.part_of_speech,
      cefrLevel: item.cefr_level,
      ipa: item.ipa,
      exampleEn: item.example_en,
      exampleFr: item.example_fr,
      usageNoteFr: item.usage_note_fr,
      synonyms: item.synonyms,
      tags: item.tags,
      sourceType: 'ai_generated',
    }));
  },

  async explainWord(word: string, translationFr: string, comparisonWord?: string): Promise<VocabularyExplanation> {
    const response = await apiPost<ApiExplanation>('/vocabulary/ai/explain', {
      word,
      translation_fr: translationFr,
      comparison_word: comparisonWord,
    });
    return {
      explanationFr: response.explanation_fr,
      examples: response.examples,
      commonMistakeFr: response.common_mistake_fr,
    };
  },

  async getSavedGeneratedWords(): Promise<SavedGeneratedVocabularyWord[]> {
    const response = await apiGet<ApiSavedGeneratedWord[]>('/vocabulary/ai/saved');
    return response.map((item) => ({
      id: item.id,
      word: item.word,
      translationFr: item.translation_fr,
      partOfSpeech: item.part_of_speech,
      cefrLevel: item.cefr_level,
      ipa: item.ipa,
      exampleEn: item.example_en,
      exampleFr: item.example_fr,
      usageNoteFr: item.usage_note_fr,
      synonyms: item.synonyms,
      tags: item.tags,
      sourceType: 'ai_generated',
      createdAt: item.created_at,
    }));
  },

  async saveGeneratedWord(word: GeneratedVocabularyWord): Promise<SavedGeneratedVocabularyWord> {
    const saved = await apiPost<ApiSavedGeneratedWord>('/vocabulary/ai/saved', {
      word: word.word,
      translation_fr: word.translationFr,
      part_of_speech: word.partOfSpeech,
      cefr_level: word.cefrLevel,
      ipa: word.ipa,
      example_en: word.exampleEn,
      example_fr: word.exampleFr,
      usage_note_fr: word.usageNoteFr,
      synonyms: word.synonyms,
      tags: word.tags,
    });
    return {
      id: saved.id,
      word: saved.word,
      translationFr: saved.translation_fr,
      partOfSpeech: saved.part_of_speech,
      cefrLevel: saved.cefr_level,
      ipa: saved.ipa,
      exampleEn: saved.example_en,
      exampleFr: saved.example_fr,
      usageNoteFr: saved.usage_note_fr,
      synonyms: saved.synonyms,
      tags: saved.tags,
      sourceType: 'ai_generated',
      createdAt: saved.created_at,
    };
  },

  async deleteSavedGeneratedWord(id: string): Promise<void> {
    await apiDelete<void>(`/vocabulary/ai/saved/${id}`);
  },
};