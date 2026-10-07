import type {
  ConversationScenarioInfo,
  ConversationSession,
  ConversationMessage,
  ConversationCorrection,
  ConversationSummary,
} from '@/types/conversation';

export const mockConversationScenarios: ConversationScenarioInfo[] = [
  {
    id: 'restaurant',
    title: 'Au restaurant',
    description: 'Commander un repas, demander des recommandations',
    icon: 'UtensilsCrossed',
    level: 'B1',
    estimatedDuration: 10,
  },
  {
    id: 'airport',
    title: "À l'aéroport",
    description: "Enregistrement, sécurité, correspondances",
    icon: 'Plane',
    level: 'B1',
    estimatedDuration: 8,
  },
  {
    id: 'doctor',
    title: 'Chez le médecin',
    description: 'Décrire des symptômes, comprendre des conseils',
    icon: 'Stethoscope',
    level: 'B1',
    estimatedDuration: 12,
  },
  {
    id: 'shopping',
    title: 'Faire les courses',
    description: 'Demander des prix, comparer des produits',
    icon: 'ShoppingBag',
    level: 'A2',
    estimatedDuration: 8,
  },
  {
    id: 'work_meeting',
    title: 'Réunion de travail',
    description: 'Présenter des idées, négocier, conclure',
    icon: 'Briefcase',
    level: 'B2',
    estimatedDuration: 15,
  },
  {
    id: 'small_talk',
    title: 'Discussion informelle',
    description: 'Parler de la météo, des loisirs, du week-end',
    icon: 'Coffee',
    level: 'A2',
    estimatedDuration: 6,
  },
  {
    id: 'hotel',
    title: "À l'hôtel",
    description: 'Réservation, réclamation, services',
    icon: 'BedDouble',
    level: 'B1',
    estimatedDuration: 10,
  },
  {
    id: 'directions',
    title: 'Demander son chemin',
    description: 'Orientation dans la ville, transports',
    icon: 'MapPin',
    level: 'A2',
    estimatedDuration: 7,
  },
  {
    id: 'free_talk',
    title: 'Conversation libre',
    description: 'Discutez librement de n\'importe quel sujet',
    icon: 'Sparkles',
    level: 'B1',
    estimatedDuration: 15,
  },
];

const replies: { content: string; translation: string; suggestions: string[] }[] = [
  {
    content: "That's great! Tell me more about it. What happened next?",
    translation: "C'est super ! Dis-m'en plus. Qu'est-ce qui s'est passé ensuite ?",
    suggestions: ["Well, actually...", "Let me think about it", "I'm not sure but..."],
  },
  {
    content: "I see what you mean. That sounds interesting. How did you feel about it?",
    translation: "Je vois ce que tu veux dire. Ça a l'air intéressant. Comment t'as trouvé ça ?",
    suggestions: ["I felt really happy", "It was a bit stressful", "Honestly, I was surprised"],
  },
  {
    content: "Oh, that's wonderful! I'd love to hear more. Could you give me an example?",
    translation: "Oh, c'est merveilleux ! J'aimerais en entendre plus. Tu pourrais me donner un exemple ?",
    suggestions: ["For example, last week...", "Sure, let me explain", "Of course! So basically..."],
  },
  {
    content: "That makes sense. What would you do differently next time?",
    translation: "Ça a du sens. Que ferais-tu différemment la prochaine fois ?",
    suggestions: ["I would probably...", "Next time I'll try to", "I think I should have"],
  },
  {
    content: "Absolutely! I completely agree with you. It's important to consider that.",
    translation: "Absolument ! Je suis tout à fait d'accord avec toi. C'est important d'en tenir compte.",
    suggestions: ["Exactly, and also...", "That's a good point", "I hadn't thought of that"],
  },
];

export function generateMockReply(
  _userMessage: string,
  showTranslation: boolean,
): ConversationMessage {
  const reply = replies[Math.floor(Math.random() * replies.length)];
  return {
    id: `msg-${Date.now()}`,
    role: 'assistant',
    content: reply.content,
    translation: showTranslation ? reply.translation : '',
    timestamp: new Date().toISOString(),
    suggestions: reply.suggestions,
  };
}

export function generateMockCorrections(userMessage: string): ConversationCorrection[] {
  const corrections: ConversationCorrection[] = [];
  const commonMistakes: { pattern: RegExp; corrected: string; explanation: string; type: ConversationCorrection['type'] }[] = [
    {
      pattern: /\bi am agree\b/i,
      corrected: 'I agree',
      explanation: "On dit « I agree » sans « am ». « Agree » est déjà un verbe, pas besoin de « be ».",
      type: 'grammar',
    },
    {
      pattern: /\binformations\b/i,
      corrected: 'information',
      explanation: "« Information » est un nom indénombrable en anglais. Il ne prend pas de « s » au pluriel.",
      type: 'grammar',
    },
    {
      pattern: /\bi have 20 years\b/i,
      corrected: 'I am 20 years old',
      explanation: "En anglais, on utilise « to be » pour l'âge, pas « to have » : « I am 20 years old ».",
      type: 'grammar',
    },
    {
      pattern: /\bsince\b.*\bagob\b/i,
      corrected: 'ago',
      explanation: "On utilise « since » avec un point de départ et « ago » avec une durée. Ne pas combiner les deux.",
      type: 'syntax',
    },
  ];

  commonMistakes.forEach((mistake, idx) => {
    if (mistake.pattern.test(userMessage)) {
      corrections.push({
        id: `correction-${Date.now()}-${idx}`,
        messageId: `msg-${Date.now()}`,
        originalText: userMessage.match(mistake.pattern)?.[0] ?? '',
        correctedText: mistake.corrected,
        explanation: mistake.explanation,
        type: mistake.type,
      });
    }
  });

  return corrections;
}

export function generateMockSummary(sessionId: string): ConversationSummary {
  return {
    sessionId,
    duration: 12,
    messagesExchanged: 8,
    correctionsCount: 3,
    strengths: [
      'Bonne fluidité dans la conversation',
      'Vocabulaire varié pour exprimer des opinions',
      'Utilisation correcte des temps du passé',
    ],
    areasToImprove: [
      "Attention aux noms indénombrables (information, advice)",
      "Prépositions de temps : « since » vs « for »",
      "Prononciation du son « th »",
    ],
    newVocabulary: [
      { word: 'to book a table', translation: 'réserver une table' },
      { word: 'to recommend', translation: 'recommander' },
      { word: 'to look forward to', translation: "attendre avec impatience" },
    ],
    overallScore: 76,
  };
}

export const mockConversationSession: ConversationSession = {
  id: 'session-001',
  scenario: 'restaurant',
  title: 'Au restaurant',
  description: 'Commander un repas, demander des recommandations',
  level: 'B1',
  messages: [],
  startedAt: new Date().toISOString(),
  endedAt: null,
  duration: 0,
  messagesCount: 0,
  correctionsCount: 0,
  summary: null,
};
