import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Heart,
  Layers,
  Loader2,
  MapPinned,
  RotateCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { vocabularyService } from '@/services/vocabulary.service';
import type {
  GeneratedVocabularyWord,
  VocabularyCollection,
  VocabularyExplanation,
  VocabularyProgress,
  VocabularyQuiz,
  VocabularyQuizFeedback,
  VocabularyQuizHistoryItem,
  VocabularyQuizQuestionType,
  VocabularyRating,
  VocabularyScenario,
  SavedGeneratedVocabularyWord,
  VocabularyWord,
} from '@/types/vocabulary';
import type { CEFRLevel } from '@/types/user';

type VocabularyTab = 'collections' | 'words' | 'reviews' | 'favorites' | 'saved' | 'scenarios' | 'quiz' | 'ai';

const levels: Array<{ value: CEFRLevel | 'all'; label: string }> = [
  { value: 'all', label: 'Tous les niveaux' },
  { value: 'A1', label: 'A1 · Débutant' },
  { value: 'A2', label: 'A2 · Élémentaire' },
  { value: 'B1', label: 'B1 · Intermédiaire' },
  { value: 'B2', label: 'B2 · Intermédiaire avancé' },
  { value: 'C1', label: 'C1 · Avancé' },
  { value: 'C2', label: 'C2 · Maîtrise' },
];

const ratings: Array<{ value: VocabularyRating; label: string; className: string }> = [
  { value: 'again', label: 'À revoir', className: 'border-destructive/40 text-destructive hover:bg-destructive/5' },
  { value: 'hard', label: 'Difficile', className: 'border-amber-500/40 text-amber-700 hover:bg-amber-500/5 dark:text-amber-300' },
  { value: 'good', label: 'Bien retenu', className: 'border-primary/40 text-primary hover:bg-primary/5' },
  { value: 'easy', label: 'Facile', className: 'border-success/40 text-success hover:bg-success/5' },
];

const quizModes: Array<{ value: VocabularyQuizQuestionType; label: string }> = [
  { value: 'synonym', label: 'Trouver le synonyme' },
  { value: 'translation_match', label: 'Association mot-traduction' },
  { value: 'fill_blank', label: 'Compléter la phrase' },
  { value: 'scramble', label: 'Lettres mélangées' },
  { value: 'odd_one_out', label: 'Jeu de l’intrus' },
];

function getLevelClass(level: CEFRLevel): string {
  if (level.startsWith('A')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (level.startsWith('B')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
}

function speakEnglish(text: string, onError: () => void) {
  if (!('speechSynthesis' in window)) {
    onError();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.onerror = onError;
  window.speechSynthesis.speak(utterance);
}

export function VocabularyPage() {
  const { toast } = useToast();
  const reviewRequestIds = useRef(new Map<string, { requestId: string; rating: VocabularyRating }>());
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const quizDeadline = useRef<number | null>(null);
  const quizFinishRequest = useRef(false);
  const [activeTab, setActiveTab] = useState<VocabularyTab>('collections');
  const [level, setLevel] = useState<CEFRLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [wordsTotal, setWordsTotal] = useState(0);
  const [wordPage, setWordPage] = useState(1);
  const [favorites, setFavorites] = useState<VocabularyWord[]>([]);
  const [savedGeneratedWords, setSavedGeneratedWords] = useState<SavedGeneratedVocabularyWord[]>([]);
  const [dueWords, setDueWords] = useState<VocabularyWord[]>([]);
  const [mistakeWords, setMistakeWords] = useState<VocabularyWord[]>([]);
  const [scenarios, setScenarios] = useState<VocabularyScenario[]>([]);
  const [progress, setProgress] = useState<VocabularyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const [error, setError] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<VocabularyCollection | null>(null);
  const [collectionWords, setCollectionWords] = useState<VocabularyWord[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);
  const [relatedWords, setRelatedWords] = useState<VocabularyWord[]>([]);
  const [wordExplanation, setWordExplanation] = useState<VocabularyExplanation | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [studyWords, setStudyWords] = useState<VocabularyWord[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [quiz, setQuiz] = useState<VocabularyQuiz | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizFeedback, setQuizFeedback] = useState<VocabularyQuizFeedback | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizFinishing, setQuizFinishing] = useState(false);
  const [quizMode, setQuizMode] = useState<VocabularyQuizQuestionType>('translation_match');
  const [quizTimeLimit, setQuizTimeLimit] = useState<60 | 120 | null>(null);
  const [quizRemaining, setQuizRemaining] = useState<number | null>(null);
  const [quizHistory, setQuizHistory] = useState<VocabularyQuizHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiTopic, setAiTopic] = useState('Voyage et transports');
  const [aiLevel, setAiLevel] = useState<CEFRLevel>('A2');
  const [aiCount, setAiCount] = useState(8);
  const [generatedWords, setGeneratedWords] = useState<GeneratedVocabularyWord[]>([]);
  const [generating, setGenerating] = useState(false);
  const [savingGeneratedSlug, setSavingGeneratedSlug] = useState<string | null>(null);

  const activeQuizId = quiz?.status === 'active' ? quiz.id : null;
  const activeQuizTimeLimit = quiz?.status === 'active' ? quiz.timeLimitSeconds : null;

  useEffect(() => {
    if (!activeQuizId || activeQuizTimeLimit === null) {
      quizDeadline.current = null;
      setQuizRemaining(null);
      return;
    }
    if (quizDeadline.current === null) {
      quizDeadline.current = Date.now() + activeQuizTimeLimit * 1000;
      quizFinishRequest.current = false;
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((quizDeadline.current! - Date.now()) / 1000));
      setQuizRemaining(remaining);
      if (remaining === 0 && !quizFinishRequest.current) {
        quizFinishRequest.current = true;
        setQuizFinishing(true);
        vocabularyService.finishQuiz(activeQuizId)
          .then((finishedQuiz) => {
            setQuiz(finishedQuiz);
            void vocabularyService.getQuizHistory().then(setQuizHistory).catch(() => undefined);
          })
          .catch(() => {
            toastRef.current('Le temps est écoulé. Impossible d’enregistrer le score pour le moment.', { variant: 'error' });
          })
          .finally(() => setQuizFinishing(false));
      }
    };
    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 250);
    return () => window.clearInterval(timerId);
  }, [activeQuizId, activeQuizTimeLimit]);

  const selectedWordSlug = selectedWord?.slug;
  useEffect(() => {
    if (!selectedWordSlug) {
      setRelatedWords([]);
      return;
    }
    let current = true;
    setRelatedWords([]);
    vocabularyService.getRelatedWords(selectedWordSlug)
      .then((items) => { if (current) setRelatedWords(items); })
      .catch(() => { if (current) setRelatedWords([]); });
    return () => { current = false; };
  }, [selectedWordSlug]);

  useEffect(() => {
    let current = true;
    Promise.all([
      vocabularyService.getCollections(),
      vocabularyService.getProgress(),
      vocabularyService.getScenarios(),
    ]).then(([collectionData, progressData, scenarioData]) => {
      if (!current) return;
      setCollections(collectionData);
      setProgress(progressData);
      setScenarios(scenarioData);
      setError('');
    }).catch(() => {
      if (current) setError('Connectez-vous pour consulter votre espace vocabulaire.');
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (activeTab !== 'words') return;
    let current = true;
    setListError('');
    setListLoading(true);
    setWords([]);
    setWordsTotal(0);
    setWordPage(1);
    const timer = window.setTimeout(() => {
      vocabularyService.getWords({ q: search.trim() || undefined, level: level === 'all' ? undefined : level, page: 1, pageSize: 60 })
        .then((result) => {
          if (!current) return;
          setWords(result.items);
          setWordsTotal(result.total);
        })
        .catch(() => { if (current) setListError('Impossible de charger le vocabulaire. Vérifiez votre connexion.'); })
        .finally(() => { if (current) setListLoading(false); });
    }, 220);
    return () => { current = false; window.clearTimeout(timer); };
  }, [activeTab, level, search]);

  const loadMoreWords = async () => {
    const nextPage = wordPage + 1;
    setLoadingMore(true);
    try {
      const result = await vocabularyService.getWords({
        q: search.trim() || undefined,
        level: level === 'all' ? undefined : level,
        page: nextPage,
        pageSize: 60,
      });
      setWords((current) => [...current, ...result.items]);
      setWordPage(nextPage);
      setWordsTotal(result.total);
    } catch {
      toast('Impossible de charger la suite du catalogue.', { variant: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'favorites') {
      let current = true;
      setListError('');
      setListLoading(true);
      vocabularyService.getFavorites()
        .then((items) => { if (current) setFavorites(items); })
        .catch(() => { if (current) setListError('Impossible de charger vos favoris.'); })
        .finally(() => { if (current) setListLoading(false); });
      return () => { current = false; };
    }
    if (activeTab === 'reviews') {
      let current = true;
      setListError('');
      setListLoading(true);
      Promise.all([vocabularyService.getDueReviews(), vocabularyService.getMistakeWords()])
        .then(([dueItems, mistakes]) => {
          if (!current) return;
          setDueWords(dueItems);
          setMistakeWords(mistakes);
        })
        .catch(() => { if (current) setListError('Impossible de charger les révisions dues.'); })
        .finally(() => { if (current) setListLoading(false); });
      return () => { current = false; };
    }
    if (activeTab === 'quiz') {
      let current = true;
      setHistoryLoading(true);
      vocabularyService.getQuizHistory()
        .then((items) => { if (current) setQuizHistory(items); })
        .catch(() => { if (current) setQuizHistory([]); })
        .finally(() => { if (current) setHistoryLoading(false); });
      return () => { current = false; };
    }
    if (activeTab === 'saved') {
      let current = true;
      setListError('');
      setListLoading(true);
      vocabularyService.getSavedGeneratedWords()
        .then((items) => { if (current) setSavedGeneratedWords(items); })
        .catch(() => { if (current) setListError('Impossible de charger vos mots enregistrés.'); })
        .finally(() => { if (current) setListLoading(false); });
      return () => { current = false; };
    }
    return undefined;
  }, [activeTab]);

  const visibleCollections = useMemo(() => collections.filter((collection) => {
    const matchesLevel = level === 'all' || collection.cefrLevel === level;
    const matchesSearch = !search.trim()
      || collection.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
      || collection.description.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
    return matchesLevel && matchesSearch;
  }), [collections, level, search]);

  const currentStudyWord = studyWords[studyIndex] ?? null;
  const currentQuizQuestion = quiz?.questions[quizIndex] ?? null;

  const openCollection = async (collection: VocabularyCollection) => {
    setSelectedCollection(collection);
    setCollectionWords([]);
    setCollectionLoading(true);
    try {
      const result = await vocabularyService.getCollectionWords(collection.slug);
      setCollectionWords(result.items);
    } catch {
      toast('Impossible de charger cette collection.', { variant: 'error' });
    } finally {
      setCollectionLoading(false);
    }
  };

  const openWord = (word: VocabularyWord) => {
    setSelectedWord(word);
    setWordExplanation(null);
  };

  const handleFavorite = async (word: VocabularyWord) => {
    const nextFavorite = !word.isFavorite;
    try {
      await vocabularyService.setFavorite(word.slug, nextFavorite);
      const updateWord = (item: VocabularyWord) => item.slug === word.slug ? { ...item, isFavorite: nextFavorite } : item;
      setWords((current) => current.map(updateWord));
      setCollectionWords((current) => current.map(updateWord));
      setFavorites((current) => nextFavorite
        ? [{ ...word, isFavorite: true }, ...current.filter((item) => item.slug !== word.slug)]
        : current.filter((item) => item.slug !== word.slug));
      setSelectedWord((current) => current?.slug === word.slug ? { ...current, isFavorite: nextFavorite } : current);
      setProgress((current) => current ? { ...current, favoriteCount: current.favoriteCount + (nextFavorite ? 1 : -1) } : current);
      toast(nextFavorite ? 'Ajouté aux favoris.' : 'Retiré des favoris.', { variant: 'success' });
    } catch {
      toast('Impossible de modifier ce favori.', { variant: 'error' });
    }
  };

  const beginStudy = (source: VocabularyWord[]) => {
    if (!source.length) {
      toast('Aucun mot à étudier dans cette liste.', { variant: 'warning' });
      return;
    }
    setStudyWords(source);
    setStudyIndex(0);
    setStudyRevealed(false);
    setStudyComplete(false);
  };

  const handleRate = async (rating: VocabularyRating) => {
    if (!currentStudyWord || reviewing) return;
    setReviewing(true);
    const pendingReview = reviewRequestIds.current.get(currentStudyWord.slug);
    const requestId = pendingReview?.rating === rating ? pendingReview.requestId : crypto.randomUUID();
    reviewRequestIds.current.set(currentStudyWord.slug, { requestId, rating });
    try {
      const result = await vocabularyService.review(currentStudyWord.slug, rating, requestId);
      reviewRequestIds.current.delete(currentStudyWord.slug);
      setStudyWords((current) => current.map((item) => item.slug === result.itemSlug
        ? { ...item, masteryLevel: result.masteryLevel, nextReviewAt: result.nextReviewAt }
        : item));
      setDueWords((current) => current.filter((item) => item.slug !== result.itemSlug));
      const updateWord = (item: VocabularyWord) => item.slug === result.itemSlug
        ? { ...item, masteryLevel: result.masteryLevel, nextReviewAt: result.nextReviewAt }
        : item;
      setWords((current) => current.map(updateWord));
      setCollectionWords((current) => current.map(updateWord));
      setFavorites((current) => current.map(updateWord));
      setSelectedWord((current) => current?.slug === result.itemSlug ? updateWord(current) : current);
      await vocabularyService.getProgress().then(setProgress).catch(() => undefined);
      await vocabularyService.getCollections().then(setCollections).catch(() => undefined);
      setStudyRevealed(false);
      if (studyIndex < studyWords.length - 1) setStudyIndex((index) => index + 1);
      else setStudyComplete(true);
    } catch {
      toast('La révision n’a pas été enregistrée. Réessayez.', { variant: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const handleExplain = async () => {
    if (!selectedWord) return;
    setExplaining(true);
    try {
      setWordExplanation(await vocabularyService.explainWord(selectedWord.word, selectedWord.translationFr));
    } catch {
      toast('Explication IA indisponible. Votre fiche reste consultable.', { variant: 'warning' });
    } finally {
      setExplaining(false);
    }
  };

  const handleCreateQuiz = async () => {
    setQuizLoading(true);
    setQuiz(null);
    quizDeadline.current = null;
    quizFinishRequest.current = false;
    setQuizFeedback(null);
    setQuizIndex(0);
    try {
      const session = await vocabularyService.createQuiz({
        collectionSlug: selectedCollection?.slug,
        level: level === 'all' ? undefined : level,
        count: 10,
        questionTypes: [quizMode],
        timeLimitSeconds: quizTimeLimit ?? undefined,
      });
      setQuiz(session);
      quizDeadline.current = session.timeLimitSeconds === null
        ? null
        : Date.parse(session.startedAt) + session.timeLimitSeconds * 1000;
      setQuizAnswer('');
      void vocabularyService.getQuizHistory().then(setQuizHistory).catch(() => undefined);
    } catch {
      toast('Impossible de créer le quiz. Vérifiez qu’il existe assez de mots dans ce niveau.', { variant: 'error' });
    } finally {
      setQuizLoading(false);
    }
  };

  const handleSubmitQuizAnswer = async () => {
    if (!quiz || !currentQuizQuestion || !quizAnswer.trim() || quizFeedback) return;
    setQuizLoading(true);
    try {
      const feedback = await vocabularyService.answerQuiz(quiz.id, currentQuizQuestion.index, quizAnswer);
      setQuizFeedback(feedback);
      setQuiz((current) => current ? { ...current, answeredCount: current.answeredCount + 1 } : current);
    } catch {
      toast('Impossible de vérifier cette réponse.', { variant: 'error' });
    } finally {
      setQuizLoading(false);
    }
  };

  const handleNextQuizQuestion = () => {
    if (!quiz || !quizFeedback) return;
    if (quizIndex < quiz.questions.length - 1) {
      setQuizIndex((index) => index + 1);
      setQuizAnswer('');
      setQuizFeedback(null);
    }
  };

  const handleFinishQuiz = async () => {
    if (!quiz) return;
    setQuizFinishing(true);
    try {
      const finishedQuiz = await vocabularyService.finishQuiz(quiz.id);
      setQuiz(finishedQuiz);
      void vocabularyService.getQuizHistory().then(setQuizHistory).catch(() => undefined);
    } catch {
      toast('Terminez toutes les questions avant de calculer le score.', { variant: 'warning' });
    } finally {
      setQuizFinishing(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedWords([]);
    try {
      setGeneratedWords(await vocabularyService.generateVocabulary({
        topic: aiTopic,
        level: aiLevel,
        count: aiCount,
        goal: 'Conversations naturelles pour francophones',
      }));
    } catch {
      toast('Génération indisponible. Le catalogue enregistré reste accessible.', { variant: 'warning' });
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGeneratedWord = async (word: GeneratedVocabularyWord) => {
    setSavingGeneratedSlug(word.word);
    try {
      const saved = await vocabularyService.saveGeneratedWord(word);
      setSavedGeneratedWords((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      toast('Mot enregistré dans « Mes mots ».', { variant: 'success' });
    } catch {
      toast('Impossible d’enregistrer cette suggestion.', { variant: 'error' });
    } finally {
      setSavingGeneratedSlug(null);
    }
  };

  const handleDeleteGeneratedWord = async (wordId: string) => {
    try {
      await vocabularyService.deleteSavedGeneratedWord(wordId);
      setSavedGeneratedWords((current) => current.filter((word) => word.id !== wordId));
      toast('Mot supprimé de « Mes mots ».', { variant: 'success' });
    } catch {
      toast('Impossible de supprimer ce mot.', { variant: 'error' });
    }
  };

  if (loading) {
    return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Chargement du vocabulaire…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <PageHeader title="Vocabulaire" subtitle="Apprenez avec des flashcards et la répétition espacée" icon={<BookOpen className="h-5 w-5" />} />
        <div role="alert" className="border-y border-border py-8 text-center text-sm text-muted-foreground">{error}</div>
      </div>
    );
  }

  if (studyWords.length > 0) {
    const studyProgress = studyComplete ? 100 : ((studyIndex + 1) / studyWords.length) * 100;
    return (
      <main className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => { setStudyWords([]); setStudyComplete(false); }}><ArrowLeft className="mr-2 h-4 w-4" />Quitter la session</Button>
          <span className="text-sm tabular-nums text-muted-foreground">{studyComplete ? studyWords.length : studyIndex + 1} / {studyWords.length}</span>
        </div>
        <div className="space-y-2"><Progress value={studyProgress} /><p className="text-right text-xs text-muted-foreground">{Math.round(studyProgress)} %</p></div>
        {studyComplete ? (
          <section className="border-y border-border py-10 text-center">
            <Check className="mx-auto h-9 w-9 text-success" />
            <h1 className="mt-3 text-xl font-semibold">Session terminée</h1>
            <p className="mt-1 text-sm text-muted-foreground">Vos évaluations et prochaines révisions ont été enregistrées.</p>
            <Button className="mt-5" onClick={() => { setStudyWords([]); setStudyComplete(false); setActiveTab('reviews'); }}>Voir les révisions dues</Button>
          </section>
        ) : currentStudyWord ? (
          <section className="space-y-5">
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-6 text-center">
              <div className="flex gap-2"><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', getLevelClass(currentStudyWord.cefrLevel))}>{currentStudyWord.cefrLevel}</span><span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{currentStudyWord.partOfSpeech}</span></div>
              <h1 className="text-3xl font-bold text-foreground">{currentStudyWord.word}</h1>
              {currentStudyWord.ipa && <p className="text-sm text-muted-foreground">{currentStudyWord.ipa}</p>}
              {studyRevealed && <div className="space-y-2 animate-fade-in"><p className="text-xl font-semibold text-primary">{currentStudyWord.translationFr}</p><p className="text-sm text-foreground">{currentStudyWord.exampleEn}</p><p className="text-sm text-muted-foreground">{currentStudyWord.exampleFr}</p></div>}
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => speakEnglish(currentStudyWord.word, () => toast('La synthèse vocale est indisponible sur cet appareil.', { variant: 'warning' }))}><Volume2 className="mr-2 h-4 w-4" />Mot</Button>
                {studyRevealed && <Button variant="outline" size="sm" onClick={() => speakEnglish(currentStudyWord.exampleEn, () => toast('La synthèse vocale est indisponible sur cet appareil.', { variant: 'warning' }))}><Volume2 className="mr-2 h-4 w-4" />Exemple</Button>}
              </div>
            </div>
            {!studyRevealed ? (
              <Button className="w-full" onClick={() => setStudyRevealed(true)}>Afficher la réponse</Button>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ratings.map((rating) => <Button key={rating.value} variant="outline" className={rating.className} disabled={reviewing} onClick={() => void handleRate(rating.value)}>{reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : rating.label}</Button>)}
              </div>
            )}
          </section>
        ) : null}
      </main>
    );
  }

  const visibleStudyWords = selectedCollection ? collectionWords : activeTab === 'favorites' ? favorites : activeTab === 'reviews' ? dueWords : words;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Vocabulaire"
        subtitle="Apprenez avec des flashcards et la répétition espacée"
        icon={<BookOpen className="h-5 w-5" />}
        action={
          <Button onClick={() => beginStudy(visibleStudyWords)} disabled={visibleStudyWords.length === 0}>
            <RotateCw className="mr-2 h-4 w-4" />Apprendre
          </Button>
        }
      />

      {progress && (
        <section className="grid grid-cols-2 gap-3 border-y border-border py-4 sm:grid-cols-4">
          <ProgressStat label="Mots étudiés" value={progress.studiedCount} />
          <ProgressStat label="Maîtrisés" value={progress.masteredCount} />
          <ProgressStat label="À réviser" value={progress.dueCount} highlight={progress.dueCount > 0} />
          <ProgressStat label="Favoris" value={progress.favoriteCount} />
          <ProgressStat label="Bonnes réponses" value={progress.successes} />
          <ProgressStat label="Erreurs" value={progress.failures} highlight={progress.failures > 0} />
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher en anglais ou en français" className="pl-9" aria-label="Rechercher un mot ou une collection" />
        </div>
        <select aria-label="Filtrer par niveau CECRL" value={level} onChange={(event) => setLevel(event.target.value as CEFRLevel | 'all')} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
          {levels.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VocabularyTab)}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="collections" className="gap-2"><Layers className="h-4 w-4" />Collections</TabsTrigger>
          <TabsTrigger value="words" className="gap-2"><BookOpen className="h-4 w-4" />Tous les mots</TabsTrigger>
          <TabsTrigger value="reviews" className="gap-2"><Clock3 className="h-4 w-4" />Révisions{progress?.dueCount ? ` · ${progress.dueCount}` : ''}</TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2"><Heart className="h-4 w-4" />Favoris</TabsTrigger>
          <TabsTrigger value="saved" className="gap-2"><Bookmark className="h-4 w-4" />Mes mots</TabsTrigger>
          <TabsTrigger value="scenarios" className="gap-2"><MapPinned className="h-4 w-4" />Scénarios</TabsTrigger>
          <TabsTrigger value="quiz" className="gap-2"><Check className="h-4 w-4" />Quiz</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-4 w-4" />IA</TabsTrigger>
        </TabsList>
        {listError && <p role="alert" className="mt-4 text-sm text-destructive">{listError}</p>}

        <TabsContent value="collections" className="mt-5 space-y-5">
          {selectedCollection ? (
            <section className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                <div className="flex gap-3">
                  <Button size="icon" variant="ghost" aria-label="Retour aux collections" onClick={() => { setSelectedCollection(null); setCollectionWords([]); }}><ArrowLeft className="h-4 w-4" /></Button>
                  <div><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', getLevelClass(selectedCollection.cefrLevel))}>{selectedCollection.cefrLevel}</span><h2 className="mt-2 text-xl font-semibold">{selectedCollection.title}</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">{selectedCollection.description}</p><p className="mt-2 text-xs text-muted-foreground">{selectedCollection.wordCount} mots · {selectedCollection.masteredCount} maîtrisés</p></div>
                </div>
                <Button onClick={() => beginStudy(collectionWords)} disabled={!collectionWords.length}><RotateCw className="mr-2 h-4 w-4" />Commencer l’apprentissage</Button>
              </div>
              {collectionLoading ? <LoadingMessage /> : <WordList words={collectionWords.filter((word) => matchesSearch(word, search))} onChoose={openWord} onFavorite={(word) => void handleFavorite(word)} onSpeak={(word) => speakEnglish(word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} emptyTitle="Aucun mot dans cette collection" />}
            </section>
          ) : (
            visibleCollections.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleCollections.map((collection) => <CollectionCard key={collection.slug} collection={collection} onOpen={() => void openCollection(collection)} />)}
              </div>
            ) : <EmptyMessage title="Aucune collection trouvée" description="Modifiez le niveau ou la recherche." />
          )}
        </TabsContent>

        <TabsContent value="words" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-muted-foreground">{wordsTotal} mots au catalogue</h2><Button variant="outline" size="sm" disabled={!words.length} onClick={() => beginStudy(words)}><RotateCw className="mr-2 h-4 w-4" />Étudier les résultats</Button></div>
          {listLoading ? <LoadingMessage /> : <WordList words={words} onChoose={openWord} onFavorite={(word) => void handleFavorite(word)} onSpeak={(word) => speakEnglish(word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} emptyTitle="Aucun mot trouvé" />}
          {!listLoading && words.length < wordsTotal && <div className="flex justify-center"><Button variant="outline" onClick={() => void loadMoreWords()} disabled={loadingMore}>{loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Charger plus</Button></div>}
        </TabsContent>

        <TabsContent value="reviews" className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-foreground">Révisions dues</h2><p className="mt-1 text-xs text-muted-foreground">Échéances calculées et enregistrées pour votre compte.</p></div><Button onClick={() => beginStudy([...new Map([...dueWords, ...mistakeWords].map((word) => [word.slug, word])).values()])} disabled={!dueWords.length && !mistakeWords.length}><RotateCw className="mr-2 h-4 w-4" />Réviser tout</Button></div>
          {listLoading ? <LoadingMessage /> : <WordList words={dueWords.filter((word) => matchesSearch(word, search))} onChoose={openWord} onFavorite={(word) => void handleFavorite(word)} onSpeak={(word) => speakEnglish(word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} emptyTitle="Aucune révision due" emptyDescription="Les mots arriveront ici selon leur prochaine date de révision." />}
          {!listLoading && mistakeWords.length > 0 && <section className="space-y-3 border-t border-border pt-4"><div><h3 className="text-sm font-semibold">Erreurs à retravailler</h3><p className="mt-1 text-xs text-muted-foreground">Mots manqués dans vos quiz, enregistrés pour votre compte.</p></div><WordList words={mistakeWords.filter((word) => matchesSearch(word, search))} onChoose={openWord} onFavorite={(word) => void handleFavorite(word)} onSpeak={(word) => speakEnglish(word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} emptyTitle="Aucune erreur correspondante" /><Button variant="outline" size="sm" onClick={() => beginStudy(mistakeWords)}><RotateCw className="mr-2 h-4 w-4" />Réviser les erreurs</Button></section>}
        </TabsContent>

        <TabsContent value="favorites" className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-foreground">Vos favoris</h2><Button variant="outline" size="sm" onClick={() => beginStudy(favorites)} disabled={!favorites.length}><RotateCw className="mr-2 h-4 w-4" />Réviser les favoris</Button></div>
          {listLoading ? <LoadingMessage /> : <WordList words={favorites.filter((word) => matchesSearch(word, search))} onChoose={openWord} onFavorite={(word) => void handleFavorite(word)} onSpeak={(word) => speakEnglish(word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} emptyTitle="Aucun favori pour le moment" emptyDescription="Ajoutez un mot avec le bouton cœur pour le retrouver ici." />}
        </TabsContent>

        <TabsContent value="saved" className="mt-5 space-y-4">
          <div><h2 className="text-sm font-semibold text-foreground">Mes mots générés</h2><p className="mt-1 text-xs text-muted-foreground">Ces fiches sont privées à votre compte et séparées du catalogue partagé.</p></div>
          {listLoading ? <LoadingMessage /> : savedGeneratedWords.length ? <div className="grid gap-3 sm:grid-cols-2">{savedGeneratedWords.filter((word) => matchesGeneratedSearch(word, search)).map((word) => <GeneratedWordCard key={word.id} word={word} onSpeak={() => speakEnglish(word.word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} onDelete={() => void handleDeleteGeneratedWord(word.id)} />)}</div> : <EmptyMessage title="Aucun mot enregistré" description="Générez du vocabulaire avec l’IA puis enregistrez les fiches utiles." />}
        </TabsContent>

        <TabsContent value="scenarios" className="mt-5 space-y-3">
          {scenarios.filter((scenario) => (level === 'all' || scenario.cefrLevel === level)
            && (!search.trim() || `${scenario.title} ${scenario.description}`.toLowerCase().includes(search.trim().toLowerCase())))
            .map((scenario) => <ScenarioCard key={scenario.slug} scenario={scenario} onWord={openWord} />)}
          {scenarios.length === 0 && <EmptyMessage title="Aucun scénario disponible" description="Les scénarios enregistrés apparaîtront ici." />}
        </TabsContent>

        <TabsContent value="quiz" className="mt-5">
          <section className="mb-6 space-y-3 border-b border-border pb-5"><h2 className="text-sm font-semibold">Historique des scores</h2>{historyLoading ? <LoadingMessage /> : quizHistory.length ? <div className="divide-y divide-border border-y border-border">{quizHistory.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{new Date(item.startedAt).toLocaleDateString('fr-FR')} · {item.answeredCount}/{item.questionCount} réponses</span><span className="font-semibold tabular-nums">{item.score === null ? 'En cours' : `${item.score}/100`}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Aucun quiz enregistré pour le moment.</p>}</section>
          {!quiz ? (
            <section className="mx-auto max-w-xl space-y-4 border-y border-border py-6">
              <div><h2 className="text-lg font-semibold">Quiz de vocabulaire</h2><p className="mt-1 text-sm text-muted-foreground">Questions tirées du catalogue publié, corrigées côté serveur.</p></div>
              <p className="text-sm text-muted-foreground">{selectedCollection ? `Collection : ${selectedCollection.title}` : level === 'all' ? 'Tous les niveaux' : `Niveau ${level}`}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-medium">Jeu</span><select value={quizMode} onChange={(event) => setQuizMode(event.target.value as VocabularyQuizQuestionType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{quizModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>
                <label className="space-y-1 text-sm"><span className="font-medium">Chronométré</span><select value={quizTimeLimit ?? ''} onChange={(event) => setQuizTimeLimit(event.target.value === '' ? null : Number(event.target.value) as 60 | 120)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sans limite</option><option value={60}>60 secondes</option><option value={120}>120 secondes</option></select></label>
              </div>
              <Button onClick={() => void handleCreateQuiz()} disabled={quizLoading}>{quizLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Préparation…</> : 'Créer un quiz de 10 questions'}</Button>
            </section>
          ) : quiz.status === 'completed' ? (
            <section className="mx-auto max-w-xl space-y-4 border-y border-border py-8 text-center"><Check className="mx-auto h-9 w-9 text-success" /><h2 className="text-xl font-semibold">Quiz terminé</h2><p className="text-4xl font-bold tabular-nums text-primary">{quiz.score ?? 0}<span className="text-lg text-muted-foreground">/100</span></p><Button onClick={() => setQuiz(null)}>Nouveau quiz</Button></section>
          ) : currentQuizQuestion ? (
            <section className="mx-auto max-w-xl space-y-5 border-y border-border py-5">
              <div className="flex items-center justify-between text-sm text-muted-foreground"><span>Question {quizIndex + 1} / {quiz.questions.length}</span><span>{quizRemaining === null ? `${quiz.answeredCount} réponses` : `${Math.floor(quizRemaining / 60)}:${String(quizRemaining % 60).padStart(2, '0')}`}</span></div>
              <Progress value={(quizIndex / quiz.questions.length) * 100} />
              <h2 className="text-lg font-semibold leading-7">{currentQuizQuestion.prompt}</h2>
              {currentQuizQuestion.options.length ? (
                <fieldset className="space-y-2"><legend className="sr-only">Choisir une réponse</legend>{currentQuizQuestion.options.map((option) => <label key={option} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-3 text-sm', quizAnswer === option ? 'border-primary bg-primary/5' : 'border-border')}><input type="radio" name="vocabulary-quiz-answer" checked={quizAnswer === option} onChange={() => setQuizAnswer(option)} />{option}</label>)}</fieldset>
              ) : <Input value={quizAnswer} onChange={(event) => setQuizAnswer(event.target.value)} placeholder="Votre réponse en anglais" aria-label="Votre réponse" />}
              {quizFeedback && <div role="status" className={cn('rounded-md border p-3 text-sm', quizFeedback.isCorrect ? 'border-success/30 bg-success/5 text-success' : 'border-amber-500/30 bg-amber-500/5 text-foreground')}><p className="font-semibold">{quizFeedback.isCorrect ? 'Bonne réponse.' : `Réponse : ${quizFeedback.correctAnswer}`}</p><p className="mt-1 text-muted-foreground">{quizFeedback.explanation}</p></div>}
              <div className="flex flex-wrap gap-2">{quizRemaining === 0 ? <Button onClick={() => void handleFinishQuiz()} disabled={quizFinishing}>{quizFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Terminer et voir le score</Button> : !quizFeedback ? <Button onClick={() => void handleSubmitQuizAnswer()} disabled={!quizAnswer.trim() || quizLoading}>{quizLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Valider</Button> : quizIndex < quiz.questions.length - 1 ? <Button onClick={handleNextQuizQuestion}>Question suivante<ChevronRight className="ml-2 h-4 w-4" /></Button> : <Button onClick={() => void handleFinishQuiz()} disabled={quizFinishing}>{quizFinishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Terminer et voir le score</Button>}</div>
            </section>
          ) : null}
        </TabsContent>

        <TabsContent value="ai" className="mt-5 space-y-5">
          <section className="max-w-2xl space-y-4 border-y border-border py-5">
            <div><h2 className="text-lg font-semibold">Générer du vocabulaire</h2><p className="mt-1 text-sm text-muted-foreground">Les propositions sont générées à la demande et restent distinctes du catalogue vérifié.</p></div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px_110px]">
              <Input value={aiTopic} onChange={(event) => setAiTopic(event.target.value)} maxLength={120} aria-label="Thème de génération" placeholder="Thème" />
              <select value={aiLevel} onChange={(event) => setAiLevel(event.target.value as CEFRLevel)} aria-label="Niveau CECRL pour la génération" className="h-10 rounded-md border border-input bg-background px-3 text-sm">{levels.filter((item) => item.value !== 'all').map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <Input type="number" min={3} max={10} value={aiCount} onChange={(event) => setAiCount(Math.min(10, Math.max(3, Number(event.target.value))))} aria-label="Nombre de mots à générer" />
            </div>
            <Button onClick={() => void handleGenerate()} disabled={generating || aiTopic.trim().length < 2}>{generating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Génération…</> : <><Sparkles className="mr-2 h-4 w-4" />Générer</>}</Button>
          </section>
          {generatedWords.length > 0 && <section className="space-y-3"><h3 className="text-sm font-semibold">{generatedWords[0].sourceType === 'catalog_fallback' ? 'Suggestions du catalogue' : 'Propositions générées · non vérifiées'}</h3><div className="grid gap-3 sm:grid-cols-2">{generatedWords.map((word) => {
            const saved = savedGeneratedWords.some((item) => item.word.toLocaleLowerCase() === word.word.toLocaleLowerCase());
            return <GeneratedWordCard key={`${word.word}-${word.cefrLevel}`} word={word} saved={saved} saving={savingGeneratedSlug === word.word} onSave={() => void handleSaveGeneratedWord(word)} onSpeak={() => speakEnglish(word.word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))} />;
          })}</div></section>}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(selectedWord)} onOpenChange={(open) => { if (!open) { setSelectedWord(null); setWordExplanation(null); } }}>
        {selectedWord && <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><div className="flex items-center gap-2"><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', getLevelClass(selectedWord.cefrLevel))}>{selectedWord.cefrLevel}</span><span className="text-xs text-muted-foreground">{selectedWord.partOfSpeech}</span></div><DialogTitle className="text-2xl">{selectedWord.word}</DialogTitle><DialogDescription>{selectedWord.ipa || 'Transcription IPA non fournie dans la fiche.'}</DialogDescription></DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-xs text-muted-foreground">{selectedWord.sourceType === 'seeded' ? 'Niveau CECR indicatif · entrée du catalogue initial' : 'Contenu généré par IA · non vérifié par un expert'}</p>
            <div><p className="text-lg font-semibold text-primary">{selectedWord.translationFr}</p>{selectedWord.additionalMeanings.length > 0 && <p className="mt-1 text-muted-foreground">Sens associés : {selectedWord.additionalMeanings.join(' · ')}</p>}</div>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => speakEnglish(selectedWord.word, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))}><Volume2 className="mr-2 h-4 w-4" />Écouter le mot</Button><Button size="sm" variant="outline" onClick={() => speakEnglish(selectedWord.exampleEn, () => toast('La synthèse vocale est indisponible.', { variant: 'warning' }))}><Volume2 className="mr-2 h-4 w-4" />Écouter l’exemple</Button><Button size="sm" variant="outline" onClick={() => void handleFavorite(selectedWord)}><Heart className={cn('mr-2 h-4 w-4', selectedWord.isFavorite && 'fill-current text-rose-600')} />{selectedWord.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</Button></div>
            <div className="border-y border-border py-3"><p className="font-medium">{selectedWord.exampleEn}</p><p className="mt-1 text-muted-foreground">{selectedWord.exampleFr}</p></div>
            {selectedWord.usageNoteFr && <p className="leading-6 text-muted-foreground">{selectedWord.usageNoteFr}</p>}
            {selectedWord.collocations.length > 0 && <p><span className="font-medium">Associations : </span><span className="text-muted-foreground">{selectedWord.collocations.join(' · ')}</span></p>}
            {selectedWord.synonyms.length > 0 && <div><p className="font-medium">Synonymes et nuances</p><ul className="mt-2 space-y-2">{selectedWord.synonyms.map((synonym) => {
              const detail = selectedWord.synonymDetails.find((item) => item.word === synonym);
              const registerLabels = { familiar: 'Familier', neutral: 'Neutre', formal: 'Formel', academic: 'Académique' };
              return <li key={synonym} className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><span className="font-medium">{synonym}</span><span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{detail ? registerLabels[detail.register] : 'Registre à préciser'}</span>{detail?.nuanceFr && <span className="text-muted-foreground">{detail.nuanceFr}</span>}</li>;
            })}</ul></div>}
            {selectedWord.antonyms.length > 0 && <p><span className="font-medium">Antonymes : </span><span className="text-muted-foreground">{selectedWord.antonyms.join(' · ')}</span></p>}
            {relatedWords.length > 0 && <div className="border-t border-border pt-3"><p className="font-medium">Fiches liées</p><div className="mt-2 divide-y divide-border">{relatedWords.map((word) => <button key={word.slug} type="button" className="flex w-full items-center justify-between gap-3 py-2 text-left" onClick={() => openWord(word)}><span><span className="font-medium">{word.word}</span><span className="ml-2 text-sm text-muted-foreground">{word.translationFr}</span></span><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /></button>)}</div></div>}
            <details className="border-t border-border pt-3"><summary className="cursor-pointer font-medium">Explication personnalisée par IA</summary><div className="pt-3"><Button size="sm" variant="outline" disabled={explaining} onClick={() => void handleExplain()}>{explaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Expliquer ce mot</Button>{wordExplanation && <div className="mt-3 space-y-3"><p className="text-xs text-muted-foreground">{wordExplanation.sourceType === 'catalog_fallback' ? 'Mode catalogue : Groq indisponible' : 'Explication générée par Groq'}</p><p className="leading-6">{wordExplanation.explanationFr}</p>{wordExplanation.examples.map((example) => <p key={example} className="border-l-2 border-primary/30 pl-3 text-muted-foreground">{example}</p>)}<p className="text-amber-700 dark:text-amber-300">Erreur fréquente : {wordExplanation.commonMistakeFr}</p></div>}</div></details>
          </div>
        </DialogContent>}
      </Dialog>
    </div>
  );
}

function matchesSearch(word: VocabularyWord, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  return !query || word.word.toLocaleLowerCase().includes(query) || word.translationFr.toLocaleLowerCase().includes(query);
}

function matchesGeneratedSearch(word: GeneratedVocabularyWord, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  return !query || word.word.toLocaleLowerCase().includes(query) || word.translationFr.toLocaleLowerCase().includes(query);
}

function ProgressStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return <div><p className="text-2xl font-semibold tabular-nums text-foreground">{value}</p><p className={cn('text-xs', highlight ? 'font-medium text-primary' : 'text-muted-foreground')}>{label}</p></div>;
}

function LoadingMessage() {
  return <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>;
}

function EmptyMessage({ title, description }: { title: string; description?: string }) {
  return <div className="border-y border-dashed border-border py-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><h3 className="mt-2 text-sm font-semibold">{title}</h3>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>;
}

function CollectionCard({ collection, onOpen }: { collection: VocabularyCollection; onOpen: () => void }) {
  const completion = collection.wordCount ? Math.round(collection.masteredCount * 100 / collection.wordCount) : 0;
  return <button type="button" onClick={onOpen} className="group rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-start justify-between gap-3"><span className={cn('flex h-9 w-9 items-center justify-center rounded-md', getLevelClass(collection.cefrLevel))}><Layers className="h-4 w-4" /></span><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', getLevelClass(collection.cefrLevel))}>{collection.cefrLevel}</span></div>
    <h3 className="mt-3 font-semibold text-foreground">{collection.title}</h3><p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{collection.description}</p>
    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground"><span>{collection.wordCount} mots</span><span>{collection.masteredCount} maîtrisés</span><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></div>
    <Progress value={completion} className="mt-2 h-1" />
  </button>;
}

function WordList({
  words,
  onChoose,
  onFavorite,
  onSpeak,
  emptyTitle,
  emptyDescription,
}: {
  words: VocabularyWord[];
  onChoose: (word: VocabularyWord) => void;
  onFavorite: (word: VocabularyWord) => void;
  onSpeak: (word: string) => void;
  emptyTitle: string;
  emptyDescription?: string;
}) {
  if (!words.length) return <EmptyMessage title={emptyTitle} description={emptyDescription} />;
  return <div className="divide-y divide-border border-y border-border">{words.map((word) => <div key={word.slug} className="flex items-center gap-3 py-3">
    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onChoose(word)}><span className="flex flex-wrap items-center gap-2"><span className="font-semibold text-foreground">{word.word}</span><span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', getLevelClass(word.cefrLevel))}>{word.cefrLevel}</span></span><span className="mt-0.5 block truncate text-sm text-muted-foreground">{word.translationFr}</span></button>
    <span className="hidden text-xs text-muted-foreground sm:block">{word.partOfSpeech}</span>
    <Button size="icon" variant="ghost" aria-label={`Écouter ${word.word}`} onClick={() => onSpeak(word.word)}><Volume2 className="h-4 w-4" /></Button>
    <Button size="icon" variant="ghost" aria-label={word.isFavorite ? `Retirer ${word.word} des favoris` : `Ajouter ${word.word} aux favoris`} onClick={() => onFavorite(word)}><Heart className={cn('h-4 w-4', word.isFavorite && 'fill-current text-rose-600')} /></Button>
    <Button size="icon" variant="ghost" aria-label={`Ouvrir la fiche ${word.word}`} onClick={() => onChoose(word)}><ChevronRight className="h-4 w-4" /></Button>
  </div>)}</div>;
}

function ScenarioCard({ scenario, onWord }: { scenario: VocabularyScenario; onWord: (word: VocabularyWord) => void }) {
  return <details className="rounded-lg border border-border bg-card p-4"><summary className="flex cursor-pointer list-none items-start justify-between gap-3"><div><span className={cn('rounded-md px-2 py-1 text-xs font-semibold', getLevelClass(scenario.cefrLevel))}>{scenario.cefrLevel}</span><h3 className="mt-2 font-semibold">{scenario.title}</h3><p className="mt-1 text-sm text-muted-foreground">{scenario.description}</p></div><ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" /></summary><div className="mt-4 space-y-3 border-t border-border pt-3 text-sm"><p><span className="font-medium">Objectif : </span><span className="text-muted-foreground">{scenario.learningObjective}</span></p><p><span className="font-medium">Situation : </span><span className="text-muted-foreground">{scenario.situation}</span></p><div className="flex flex-wrap gap-2">{scenario.usefulPhrases.map((phrase) => <span key={phrase} className="rounded-md bg-muted px-2 py-1 text-xs">{phrase}</span>)}</div><div className="flex flex-wrap gap-2">{scenario.words.map((word) => <button key={word.slug} type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => onWord(word)}>{word.word}</button>)}</div></div></details>;
}

function GeneratedWordCard({
  word,
  onSpeak,
  onSave,
  onDelete,
  saved = false,
  saving = false,
}: {
  word: GeneratedVocabularyWord | SavedGeneratedVocabularyWord;
  onSpeak: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  saved?: boolean;
  saving?: boolean;
}) {
  return <article className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{word.word}</h3><p className="mt-1 text-sm text-primary">{word.translationFr}</p></div><Button size="icon" variant="ghost" aria-label={`Écouter ${word.word}`} onClick={onSpeak}><Volume2 className="h-4 w-4" /></Button></div><p className="mt-3 text-xs text-muted-foreground">{word.cefrLevel} · {word.partOfSpeech}{word.ipa ? ` · ${word.ipa}` : ''}</p><div className="mt-3 border-t border-border pt-3"><p className="text-sm">{word.exampleEn}</p><p className="mt-1 text-sm text-muted-foreground">{word.exampleFr}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{word.usageNoteFr}</p></div>{onSave && <Button className="mt-3" size="sm" variant="outline" disabled={saving || saved} onClick={onSave}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : saved ? <Check className="mr-2 h-4 w-4" /> : <Bookmark className="mr-2 h-4 w-4" />}{saved ? 'Enregistré' : 'Enregistrer'}</Button>}{onDelete && <Button className="mt-3" size="sm" variant="outline" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button>}</article>;
}