import type { PronunciationFeedback } from '@/types/conversation';

export const mockPronunciationFeedback: PronunciationFeedback = {
  overallScore: 78,
  fluency: 82,
  accuracy: 75,
  pacing: 76,
  issues: [
    { word: 'book', issue: 'Prononciation du son /ʊ/', suggestion: "Essayez de relâcher les lèvres, le son est court et arrondi." },
    { word: 'table', issue: 'Accent tonique', suggestion: "L'accent est sur la première syllabe : TABLE." },
    { word: "o'clock", issue: "Prononciation du son /ɒ/", suggestion: "Le « o » est ouvert, comme dans « hot »." },
  ],
  strengths: [
    'Bonne intonation générale',
    'Rythme de parole naturel',
    'Liaisons bien réalisées',
  ],
};
