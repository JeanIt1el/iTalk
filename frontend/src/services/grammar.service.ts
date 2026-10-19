import type { CEFRLevel } from '@/types/user';
import type { GrammarEnrichment, GrammarExerciseFeedback, GrammarRoadmap, GrammarTopic } from '@/types/grammar';
import { apiGet, apiPost } from './api-client';

interface ApiTopic extends Omit<GrammarTopic, 'durationMinutes'> {
  duration_minutes: number;
}

interface ApiRoadmap extends Omit<GrammarRoadmap, 'categories'> {
  categories: Array<{
    id: string;
    title: string;
    topics: ApiTopic[];
  }>;
}

interface ApiEnrichment extends Omit<GrammarEnrichment, 'topicId'> {
  topic_id: string;
}

interface ApiExerciseFeedback extends Omit<GrammarExerciseFeedback, 'exerciseId'> {
  exercise_id: string;
}

function mapTopic(topic: ApiTopic): GrammarTopic {
  const { duration_minutes, ...rest } = topic;
  return { ...rest, durationMinutes: duration_minutes };
}

export const grammarService = {
  async getRoadmap(level: CEFRLevel): Promise<GrammarRoadmap> {
    const roadmap = await apiGet<ApiRoadmap>(`/grammar/roadmap/${level}`);
    return {
      ...roadmap,
      categories: roadmap.categories.map((category) => ({
        ...category,
        topics: category.topics.map(mapTopic),
      })),
    };
  },

  async getTopic(topicId: string): Promise<GrammarTopic> {
    const topic = await apiGet<ApiTopic & { category: string }>(`/grammar/topics/${topicId}`);
    return { ...mapTopic(topic), category: topic.category };
  },

  async checkExercise(topicId: string, exerciseId: string, answer: string): Promise<GrammarExerciseFeedback> {
    const feedback = await apiPost<ApiExerciseFeedback>(
      `/grammar/topics/${topicId}/exercises/${exerciseId}/check`,
      { answer },
    );
    const { exercise_id, ...rest } = feedback;
    return { ...rest, exerciseId: exercise_id };
  },

  async enrichTopic(topicId: string, focus = ''): Promise<GrammarEnrichment> {
    const enrichment = await apiPost<ApiEnrichment>(`/grammar/topics/${topicId}/enrich`, { focus });
    const { topic_id, ...rest } = enrichment;
    return { ...rest, topicId: topic_id };
  },
};