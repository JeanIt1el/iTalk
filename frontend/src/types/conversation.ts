import type { CEFRLevel } from './user';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ConversationScenario =
  | 'restaurant'
  | 'airport'
  | 'doctor'
  | 'shopping'
  | 'work_meeting'
  | 'small_talk'
  | 'hotel'
  | 'directions'
  | 'free_talk';

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  content: string;
  translation: string;
  timestamp: string;
  corrections?: ConversationCorrection[];
  suggestions?: string[];
  isTyping?: boolean;
}

export interface ConversationCorrection {
  id: string;
  messageId: string;
  originalText: string;
  correctedText: string;
  explanation: string;
  type: 'grammar' | 'vocabulary' | 'pronunciation' | 'syntax';
}

export interface ConversationSession {
  id: string;
  scenario: ConversationScenario;
  title: string;
  description: string;
  level: CEFRLevel;
  messages: ConversationMessage[];
  startedAt: string;
  endedAt: string | null;
  duration: number;
  messagesCount: number;
  correctionsCount: number;
  summary: ConversationSummary | null;
}

export interface ConversationSummary {
  sessionId: string;
  duration: number;
  messagesExchanged: number;
  correctionsCount: number;
  strengths: string[];
  areasToImprove: string[];
  newVocabulary: { word: string; translation: string }[];
  overallScore: number;
}

export interface ConversationScenarioInfo {
  id: ConversationScenario;
  title: string;
  description: string;
  icon: string;
  level: CEFRLevel;
  estimatedDuration: number;
}

export interface SpeechRecording {
  id: string;
  transcript: string;
  duration: number;
  pronunciationScore: number;
  feedback: PronunciationFeedback;
  createdAt: string;
}

export interface PronunciationFeedback {
  overallScore: number;
  fluency: number;
  accuracy: number;
  pacing: number;
  issues: { word: string; issue: string; suggestion: string }[];
  strengths: string[];
}
