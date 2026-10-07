import type { SpeechRecording, PronunciationFeedback } from '@/types/conversation';
import { delay } from './api-client';
import { mockPronunciationFeedback } from '@/data/mock-speech';

/**
 * Mock speech service.
 * Will be replaced by FastAPI speech-to-text and text-to-speech endpoints.
 */

export const speechService = {
  async startRecording(): Promise<{ recordingId: string }> {
    await delay(200);
    return { recordingId: `rec-${Date.now()}` };
  },

  async stopRecording(recordingId: string): Promise<SpeechRecording> {
    await delay(800);
    return {
      id: recordingId,
      transcript: "I'd like to book a table for two at seven o'clock, please.",
      duration: 12,
      pronunciationScore: 78,
      feedback: mockPronunciationFeedback,
      createdAt: new Date().toISOString(),
    };
  },

  async getTranscript(recordingId: string): Promise<string> {
    await delay(500);
    return "I'd like to book a table for two at seven o'clock, please.";
  },

  async getPronunciationFeedback(recordingId: string): Promise<PronunciationFeedback> {
    await delay(600);
    return mockPronunciationFeedback;
  },

  async textToSpeech(text: string): Promise<{ audioUrl: string }> {
    await delay(300);
    return { audioUrl: `mock://tts/${encodeURIComponent(text.slice(0, 20))}` };
  },

  async playAudio(audioUrl: string): Promise<void> {
    await delay(100);
  },
};
