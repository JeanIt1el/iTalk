import type { CEFRLevel, LearningGoal, LearningPace, TargetLanguage } from '@/types/user';

export const APP_NAME = 'iTalk';
export const APP_TAGLINE = 'Apprenez les langues avec une IA conversationnelle';

export const CEFR_LEVELS: { value: CEFRLevel; label: string; description: string }[] = [
  { value: 'A1', label: 'A1 — Débutant', description: 'Je débute complètement' },
  { value: 'A2', label: 'A2 — Élémentaire', description: 'Je connais les bases' },
  { value: 'B1', label: 'B1 — Intermédiaire', description: 'Je peux converser simplement' },
  { value: 'B2', label: 'B2 — Avancé', description: 'Je me débrouille assez bien' },
  { value: 'C1', label: 'C1 — Autonome', description: 'Je suis à l\'aise' },
  { value: 'C2', label: 'C2 — Maîtrise', description: 'Je parle couramment' },
];

export const TARGET_LANGUAGES: { value: TargetLanguage; label: string; flag: string }[] = [
  { value: 'en', label: 'Anglais', flag: '🇬🇧' },
  { value: 'es', label: 'Espagnol', flag: '🇪🇸' },
  { value: 'de', label: 'Allemand', flag: '🇩🇪' },
  { value: 'it', label: 'Italien', flag: '🇮🇹' },
  { value: 'pt', label: 'Portugais', flag: '🇵🇹' },
  { value: 'zh', label: 'Chinois', flag: '🇨🇳' },
  { value: 'ja', label: 'Japonais', flag: '🇯🇵' },
];

export const LEARNING_GOALS: { value: LearningGoal; label: string; icon: string }[] = [
  { value: 'travel', label: 'Voyager', icon: 'Plane' },
  { value: 'work', label: 'Travailler', icon: 'Briefcase' },
  { value: 'study', label: 'Étudier', icon: 'GraduationCap' },
  { value: 'daily', label: 'Au quotidien', icon: 'Coffee' },
  { value: 'exam', label: 'Préparer un examen', icon: 'Award' },
  { value: 'culture', label: 'Découvrir une culture', icon: 'Globe' },
];

export const LEARNING_PACES: { value: LearningPace; label: string; description: string; minutesPerDay: number }[] = [
  { value: 'casual', label: 'Décontracté', description: '5-10 min par jour', minutesPerDay: 10 },
  { value: 'regular', label: 'Régulier', description: '15-20 min par jour', minutesPerDay: 20 },
  { value: 'intensive', label: 'Intensif', description: '30+ min par jour', minutesPerDay: 30 },
];

export const INTEREST_OPTIONS = [
  'Voyage', 'Culture', 'Technologie', 'Cinéma', 'Musique', 'Sport',
  'Cuisine', 'Littérature', 'Histoire', 'Sciences', 'Économie',
  'Santé', 'Environnement', 'Mode', 'Art', 'Jeux vidéo',
];

export const SKILL_LABELS: Record<string, string> = {
  conversation: 'Conversation',
  grammar: 'Grammaire',
  vocabulary: 'Vocabulaire',
  speaking: 'Expression orale',
  listening: 'Compréhension orale',
};

export const SKILL_ICONS: Record<string, string> = {
  conversation: 'MessageCircle',
  grammar: 'PenLine',
  vocabulary: 'Layers',
  speaking: 'Mic',
  listening: 'Headphones',
};

export const NAV_ITEMS = [
  { path: '/home', label: 'Accueil', icon: 'Home' },
  { path: '/modules', label: 'Apprendre', icon: 'GraduationCap' },
  { path: '/conversation', label: 'Discuter', icon: 'MessageCircle' },
  { path: '/progress', label: 'Progrès', icon: 'TrendingUp' },
  { path: '/profile', label: 'Profil', icon: 'User' },
] as const;

export const SIDEBAR_ITEMS = [
  ...NAV_ITEMS,
  { path: '/grammar', label: 'Grammaire', icon: 'PenLine' },
  { path: '/vocabulary', label: 'Vocabulaire', icon: 'Layers' },
  { path: '/speaking', label: 'Expression orale', icon: 'Mic' },
  { path: '/settings', label: 'Paramètres', icon: 'Settings' },
] as const;
