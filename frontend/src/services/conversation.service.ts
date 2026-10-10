import type {
  ConversationMessage,
  ConversationSession,
  ConversationScenario,
  ConversationScenarioInfo,
  ConversationSummary,
  ConversationCorrection,
} from '@/types/conversation';
import { apiGet, apiPost } from './api-client';

const DEFAULT_SCENARIOS: ConversationScenarioInfo[] = [
  {
    id: 'restaurant',
    title: 'Commande au restaurant',
    description: 'Commandez un repas et demandez des recommandations.',
    icon: 'UtensilsCrossed',
    level: 'B1',
    estimatedDuration: 10,
  },
  {
    id: 'airport',
    title: 'Voyage',
    description: 'Pratiquez les échanges utiles pendant un voyage.',
    icon: 'Plane',
    level: 'B1',
    estimatedDuration: 8,
  },
  {
    id: 'free_talk',
    title: 'Discussion libre',
    description: 'Discutez librement d’un sujet de votre choix.',
    icon: 'MessageCircle',
    level: 'B1',
    estimatedDuration: 10,
  },
];

function responseArray<T>(response: unknown): T[] {
  let value = response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (Array.isArray(value)) return value as T[];
    if (!value || typeof value !== 'object' || !('data' in value)) return [];
    value = (value as Record<string, unknown>).data;
  }
  return Array.isArray(value) ? value as T[] : [];
}

function mapMessage(message: Record<string, unknown>): ConversationMessage {
  return {
    id: String(message.id),
    role: message.role as ConversationMessage['role'],
    content: String(message.content),
    translation: String(message.translation ?? ''),
    timestamp: String(message.timestamp),
    corrections: [],
    suggestions: (message.suggestions as string[] | undefined) ?? [],
  };
}

function mapSession(session: Record<string, unknown>): ConversationSession {
  return {
    id: String(session.id),
    scenario: String(session.scenario) as ConversationScenario,
    title: String(session.title),
    description: String(session.description),
    level: session.level as ConversationSession['level'],
    messages: responseArray<Record<string, unknown>>(session.messages).map(mapMessage),
    startedAt: String(session.started_at),
    endedAt: session.ended_at ? String(session.ended_at) : null,
    duration: Number(session.duration ?? 0),
    messagesCount: Number(session.messages_count ?? 0),
    correctionsCount: Number(session.corrections_count ?? 0),
    summary: (session.summary as ConversationSummary | null | undefined) ?? null,
  };
}

function mapSummary(summary: Record<string, unknown>): ConversationSummary {
  return {
    sessionId: String(summary.session_id),
    duration: Number(summary.duration),
    messagesExchanged: Number(summary.messages_exchanged),
    correctionsCount: Number(summary.corrections_count),
    strengths: (summary.strengths as string[]) ?? [],
    areasToImprove: (summary.areas_to_improve as string[]) ?? [],
    newVocabulary: (summary.new_vocabulary as ConversationSummary['newVocabulary']) ?? [],
    overallScore: Number(summary.overall_score),
  };
}

export const conversationService = {
  async getScenarios(): Promise<ConversationScenarioInfo[]> {
    let response: unknown;
    try {
      response = await apiGet<unknown>('/conversation/scenarios');
    } catch {
      return DEFAULT_SCENARIOS.map((scenario) => ({ ...scenario }));
    }
    const scenarios = responseArray<Record<string, unknown>>(response)
      .filter((scenario) => scenario && typeof scenario === 'object')
      .map((scenario) => ({
        id: String(scenario.id) as ConversationScenario,
        title: String(scenario.title),
        description: String(scenario.description),
        icon: String(scenario.icon),
        level: scenario.level as ConversationScenarioInfo['level'],
        estimatedDuration: Number(scenario.estimated_duration),
      }))
      .filter((scenario) => scenario.id && scenario.title !== 'undefined');
    return scenarios.length
      ? scenarios
      : DEFAULT_SCENARIOS.map((scenario) => ({ ...scenario }));
  },

  async startSession(scenario: ConversationScenario): Promise<ConversationSession> {
    const session = await apiPost<Record<string, unknown>>('/conversation/sessions', { scenario });
    return mapSession(session);
  },

  async sendMessage(
    sessionId: string,
    content: string,
    showTranslation: boolean,
    enableCorrections: boolean,
    signal?: AbortSignal,
    onTyping?: () => void,
    onMessage?: (message: ConversationMessage) => void,
    onCorrections?: (corrections: ConversationCorrection[]) => void,
    onSuggestions?: (suggestions: string[]) => void,
    onSummary?: (summary: ConversationSummary) => void,
    onEndSession?: (session: ConversationSession) => void,
    onEndOfSession?: (summary: ConversationSummary) => void,
    onSessionUpdate?: (session: ConversationSession) => void,
    onCorrection?: (corrections: ConversationCorrection[]) => void,
    onSuggestion?: (suggestions: string[]) => void,
    onTypingState?: (isTyping: boolean) => void,
    onSummaryReady?: (summary: ConversationSummary) => void,
    onSessionEnd?: (session: ConversationSession) => void,
    onSessionSummary?: (summary: ConversationSummary) => void,
    onSessionComplete?: (session: ConversationSession) => void,
  ): Promise<ConversationMessage> {
    onTyping?.();
    const result = await apiPost<Record<string, unknown>>(
      `/conversation/sessions/${sessionId}/messages`,
      { content, show_translation: showTranslation, enable_corrections: enableCorrections },
      { signal },
    );
    const reply = mapMessage(result);
    onSuggestions?.(reply.suggestions ?? []);
    onSuggestion?.(reply.suggestions ?? []);
    onMessage?.(reply);
    return reply;
  },

  async endSession(sessionId: string): Promise<ConversationSummary> {
    const summary = await apiPost<Record<string, unknown>>(`/conversation/sessions/${sessionId}/end`);
    return mapSummary(summary);
  },

  async getSession(sessionId: string): Promise<ConversationSession> {
    const sessions = await this.getSessions();
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) throw new Error('Conversation session not found');
    return session;
  },

  async getSessions(): Promise<ConversationSession[]> {
    let response: unknown;
    try {
      response = await apiGet<unknown>('/conversation/sessions');
    } catch {
      return [];
    }
    return responseArray<Record<string, unknown>>(response).map(mapSession);
  },
};