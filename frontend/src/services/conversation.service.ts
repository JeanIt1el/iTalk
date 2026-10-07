import type {
  ConversationMessage,
  ConversationSession,
  ConversationScenario,
  ConversationScenarioInfo,
  ConversationSummary,
  ConversationCorrection,
} from '@/types/conversation';
import { delay } from './api-client';
import {
  mockConversationScenarios,
  mockConversationSession,
  generateMockReply,
  generateMockCorrections,
  generateMockSummary,
} from '@/data/mock-conversation';

/**
 * Mock conversation service.
 * Will be replaced by FastAPI + LangGraph conversation agent endpoints.
 */

export const conversationService = {
  async getScenarios(): Promise<ConversationScenarioInfo[]> {
    await delay();
    return mockConversationScenarios;
  },

  async startSession(scenario: ConversationScenario): Promise<ConversationSession> {
    await delay(500);
    const info = mockConversationScenarios.find((s) => s.id === scenario);
    return {
      ...mockConversationSession,
      scenario,
      title: info?.title ?? 'Conversation libre',
      description: info?.description ?? '',
      level: info?.level ?? 'B1',
      messages: [
        {
          id: 'msg-welcome',
          role: 'assistant',
          content: "Hello! I'm your AI conversation partner. What would you like to talk about today?",
          translation: "Bonjour ! Je suis votre partenaire de conversation IA. De quoi aimeriez-vous parler aujourd'hui ?",
          timestamp: new Date().toISOString(),
          suggestions: ["Let's talk about our day", 'I want to practice ordering food', 'Can we discuss travel?'],
        },
      ],
    };
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
    // Signal typing indicator
    onTyping?.();

    await delay(800, signal);

    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const reply = generateMockReply(content, showTranslation);

    if (enableCorrections) {
      const corrections = generateMockCorrections(content);
      if (corrections.length > 0) {
        onCorrections?.(corrections);
        onCorrection?.(corrections);
      }
    }

    onSuggestions?.(reply.suggestions ?? []);
    onSuggestion?.(reply.suggestions ?? []);

    onMessage?.(reply);
    return reply;
  },

  async endSession(sessionId: string): Promise<ConversationSummary> {
    await delay(600);
    return generateMockSummary(sessionId);
  },

  async getSession(sessionId: string): Promise<ConversationSession> {
    await delay();
    return mockConversationSession;
  },

  async getSessions(): Promise<ConversationSession[]> {
    await delay();
    return [mockConversationSession];
  },
};
