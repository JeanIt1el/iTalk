import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  Loader2,
  PenLine,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { grammarService } from '@/services/grammar.service';
import { learningService } from '@/services/learning.service';
import type { GrammarEnrichment, GrammarExercise, GrammarExerciseFeedback, GrammarRoadmap, GrammarTopic } from '@/types/grammar';
import type { GrammarResult } from '@/types/learning';
import type { CEFRLevel } from '@/types/user';

const levels: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const categoryLabels: Record<string, string> = {
  spelling: 'Orthographe',
  grammar: 'Grammaire',
  punctuation: 'Ponctuation',
  word_choice: 'Choix de mots',
  syntax: 'Syntaxe',
};

export function GrammarPage() {
  const { toast } = useToast();
  const lessonPanelRef = useRef<HTMLElement | null>(null);
  const [level, setLevel] = useState<CEFRLevel>('B1');
  const [topicSearch, setTopicSearch] = useState('');
  const [roadmap, setRoadmap] = useState<GrammarRoadmap | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<GrammarTopic | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [roadmapError, setRoadmapError] = useState(false);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState<Record<string, string>>({});
  const [exerciseFeedback, setExerciseFeedback] = useState<Record<string, GrammarExerciseFeedback>>({});
  const [checkingExercises, setCheckingExercises] = useState<Record<string, boolean>>({});
  const [enrichment, setEnrichment] = useState<GrammarEnrichment | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [text, setText] = useState('');
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    let current = true;
    setLoadingRoadmap(true);
    setRoadmapError(false);
    setRoadmap(null);
    setSelectedTopic(null);
    setEnrichment(null);
    grammarService.getRoadmap(level)
      .then((data) => {
        if (!current) return;
        setRoadmap(data);
        setSelectedTopic(data.categories[0]?.topics[0] ?? null);
      })
      .catch(() => {
        if (current) setRoadmapError(true);
      })
      .finally(() => {
        if (current) setLoadingRoadmap(false);
      });
    return () => { current = false; };
  }, [level]);

  const handleSelectTopic = async (topic: GrammarTopic) => {
    window.requestAnimationFrame(() => {
      const lessonPanel = lessonPanelRef.current;
      lessonPanel?.scrollTo({ top: 0, behavior: 'smooth' });
      lessonPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setSelectedTopic(topic);
    setEnrichment(null);
    setExerciseAnswers({});
    setExerciseFeedback({});
    setCheckingExercises({});
    setLoadingLesson(true);
    try {
      setSelectedTopic(await grammarService.getTopic(topic.id));
    } catch {
      toast('Impossible de charger cette leçon', { variant: 'error' });
    } finally {
      setLoadingLesson(false);
    }
  };

  const handleCheckExercise = async (topicId: string, exerciseId: string) => {
    setCheckingExercises((current) => ({ ...current, [exerciseId]: true }));
    try {
      const feedback = await grammarService.checkExercise(
        topicId,
        exerciseId,
        exerciseAnswers[exerciseId] ?? '',
      );
      setExerciseFeedback((current) => ({ ...current, [exerciseId]: feedback }));
    } catch {
      toast('Impossible de vérifier cet exercice', { variant: 'error' });
    } finally {
      setCheckingExercises((current) => ({ ...current, [exerciseId]: false }));
    }
  };

  const handleEnrich = async () => {
    if (!selectedTopic) return;
    setEnriching(true);
    try {
      setEnrichment(await grammarService.enrichTopic(selectedTopic.id));
    } catch {
      toast('Enrichissement indisponible. Vérifiez la configuration Groq.', { variant: 'warning' });
    } finally {
      setEnriching(false);
    }
  };

  const handleCheck = async () => {
    if (!text.trim()) {
      toast('Veuillez écrire un texte à analyser', { variant: 'warning' });
      return;
    }
    setLoadingCheck(true);
    setResult(null);
    setShowComparison(false);
    try {
      const response = await learningService.checkGrammar(text, level);
      setResult(response);
      toast(`${response.mistakes.length} erreur${response.mistakes.length > 1 ? 's' : ''} détectée${response.mistakes.length > 1 ? 's' : ''}`, {
        variant: response.mistakes.length > 0 ? 'warning' : 'success',
      });
    } catch {
      toast("Erreur lors de l'analyse", { variant: 'error' });
    } finally {
      setLoadingCheck(false);
    }
  };

  const topicCount = roadmap?.categories.reduce((total, category) => total + category.topics.length, 0) ?? 0;
  const searchQuery = topicSearch.trim().toLocaleLowerCase();
  const visibleCategories = roadmap?.categories.map((category) => {
    const categoryMatches = category.title.toLocaleLowerCase().includes(searchQuery);
    return {
      ...category,
      topics: categoryMatches || !searchQuery
        ? category.topics
        : category.topics.filter((topic) => topic.title.toLocaleLowerCase().includes(searchQuery)),
    };
  }).filter((category) => category.topics.length > 0) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Grammaire anglaise"
        subtitle="Un parcours progressif, du premier present simple aux structures expertes."
        icon={<BookOpen className="h-5 w-5" />}
      />

      <Tabs defaultValue="roadmap" className="space-y-5">
        <TabsList aria-label="Outils de grammaire">
          <TabsTrigger value="roadmap" className="gap-2"><BookOpen className="h-4 w-4" />Parcours</TabsTrigger>
          <TabsTrigger value="checker" className="gap-2"><PenLine className="h-4 w-4" />Correcteur</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="space-y-5">
          <section className="space-y-3" aria-label="Choisir un niveau CECR">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Votre niveau cible</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">Parcours CECR</h2>
              </div>
              {roadmap && <p className="text-sm text-muted-foreground">{topicCount} leçons</p>}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {levels.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={level === item}
                  onClick={() => setLevel(item)}
                  className={cn(
                    'min-h-14 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    level === item
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/40',
                  )}
                >
                  <span className="block text-sm font-bold">{item}</span>
                  <span className={cn('block text-[11px]', level === item ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                    {item === 'A1' ? 'Débutant' : item === 'A2' ? 'Élémentaire' : item === 'B1' ? 'Intermédiaire' : item === 'B2' ? 'Avancé' : item === 'C1' ? 'Autonome' : 'Expert'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {loadingRoadmap ? (
            <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement du parcours…
            </div>
          ) : roadmapError ? (
            <div role="alert" className="border-y border-border py-8 text-center text-sm text-muted-foreground">
              Impossible de charger le parcours. Vérifiez la connexion au serveur et réessayez.
            </div>
          ) : roadmap && (
            <>
              <section className="border-y border-border py-5 sm:flex sm:items-end sm:justify-between sm:gap-8">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold text-primary">Niveau {roadmap.level}</p>
                  <h2 className="mt-1 text-2xl font-bold text-foreground">{roadmap.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{roadmap.description}</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground sm:mt-0">{roadmap.categories.length} thèmes · {topicCount} leçons</p>
              </section>

              <div className="grid gap-6 lg:h-[min(68vh,52rem)] lg:min-h-96 lg:grid-cols-[minmax(260px,0.82fr)_minmax(0,1.5fr)]">
                <nav aria-label={`Leçons du niveau ${roadmap.level}`} className="space-y-5 lg:min-h-0 lg:overflow-y-auto lg:pr-3">
                  <Input
                    value={topicSearch}
                    onChange={(event) => setTopicSearch(event.target.value)}
                    placeholder="Rechercher une leçon ou un thème"
                    aria-label="Rechercher une leçon ou un thème"
                  />
                  {visibleCategories.length === 0 && (
                    <p className="py-5 text-sm text-muted-foreground">Aucun thème ne correspond à cette recherche.</p>
                  )}
                  {visibleCategories.map((category, categoryIndex) => (
                    <section key={category.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{categoryIndex + 1}</span>
                        <h3 className="text-sm font-semibold text-foreground">{category.title}</h3>
                      </div>
                      <ol className="space-y-1 border-l border-border pl-3 ml-3">
                        {category.topics.map((topic, topicIndex) => {
                          const active = selectedTopic?.id === topic.id;
                          return (
                            <li key={topic.id}>
                              <button
                                type="button"
                                aria-current={active ? 'step' : undefined}
                                onClick={() => void handleSelectTopic(topic)}
                                className={cn(
                                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
                                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                                )}
                              >
                                <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background')}>
                                  {active ? <BookOpen className="h-3.5 w-3.5" /> : `${topicIndex + 1}`}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium leading-snug">{topic.title}</span>
                                  <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3 w-3" />{topic.durationMinutes} min</span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0" />
                              </button>
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
                </nav>

                <article ref={lessonPanelRef} className="min-w-0 scroll-mt-6 border-t border-border pt-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0 lg:pr-3">
                  {selectedTopic ? (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{selectedTopic.category ?? roadmap.categories.find((category) => category.topics.some((topic) => topic.id === selectedTopic.id))?.title}</p>
                          <h2 className="mt-1 text-xl font-bold text-foreground">{selectedTopic.title}</h2>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{selectedTopic.durationMinutes} minutes</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => void handleEnrich()} disabled={enriching || loadingLesson}>
                          {enriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          Approfondir
                        </Button>
                      </div>

                      {loadingLesson ? (
                        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Ouverture de la leçon…</div>
                      ) : (
                        <div className="mt-6 space-y-6">
                          <section>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><BookOpen className="h-4 w-4 text-primary" />Formule / Structure</h3>
                            <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 font-mono text-sm leading-6 text-foreground">{selectedTopic.formula}</p>
                            <h3 className="mt-5 text-sm font-semibold text-foreground">Explication détaillée</h3>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">{selectedTopic.explanation}</p>
                          </section>
                          <section>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><ArrowRight className="h-4 w-4 text-primary" />Exemples concrets</h3>
                            <div className="mt-3 divide-y divide-border border-y border-border">
                              {selectedTopic.examples.map((example) => (
                                <div key={example.english} className="grid gap-1 py-3 sm:grid-cols-2 sm:gap-4">
                                  <p className="text-sm font-medium text-foreground">{example.english}</p>
                                  <p className="text-sm text-muted-foreground">{example.french}</p>
                                </div>
                              ))}
                            </div>
                          </section>
                          <section>
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Lightbulb className="h-4 w-4 text-amber-600" />Cas particuliers</h3>
                            <ul className="mt-3 space-y-2">
                              {selectedTopic.exceptions.map((item) => (
                                <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{item}
                                </li>
                              ))}
                            </ul>
                          </section>

                          <section className="border-t border-border pt-5">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Check className="h-4 w-4 text-primary" />À vous de pratiquer</h3>
                            <p className="mt-1 text-xs text-muted-foreground">Validez les acquis de cette leçon avant de continuer.</p>
                            <div className="mt-3 space-y-4">
                              {selectedTopic.exercises.map((exercise) => {
                                const answer = exerciseAnswers[exercise.id] ?? '';
                                const feedback = exerciseFeedback[exercise.id] ?? null;
                                const checking = checkingExercises[exercise.id] ?? false;
                                return (
                                  <ExerciseCard
                                    key={exercise.id}
                                    exercise={exercise}
                                    answer={answer}
                                    feedback={feedback}
                                    checking={checking}
                                    onAnswer={(value) => {
                                      setExerciseAnswers((current) => ({ ...current, [exercise.id]: value }));
                                      setExerciseFeedback((current) => {
                                        const next = { ...current };
                                        delete next[exercise.id];
                                        return next;
                                      });
                                    }}
                                    onCheck={() => void handleCheckExercise(selectedTopic.id, exercise.id)}
                                  />
                                );
                              })}
                            </div>
                          </section>

                          {enrichment && (
                            <section className="border-t border-border pt-5" aria-live="polite">
                              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Sparkles className="h-4 w-4 text-primary" />Approfondissement IA</h3>
                              <p className="mt-2 text-sm leading-7 text-muted-foreground">{enrichment.explanation}</p>
                              <div className="mt-4 space-y-2">
                                {enrichment.exercises.map((exercise, index) => (
                                  <details key={`${index}-${exercise.question}`} className="border-b border-border py-3">
                                    <summary className="cursor-pointer text-sm font-medium text-foreground">{exercise.question}</summary>
                                    <div className="mt-3 space-y-1 pl-3 text-sm">
                                      <p className="text-primary">{exercise.answer}</p>
                                      <p className="text-muted-foreground">{exercise.explanation}</p>
                                    </div>
                                  </details>
                                ))}
                              </div>
                            </section>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">Aucune leçon disponible pour ce niveau.</div>
                  )}
                </article>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="checker" className="mx-auto max-w-3xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Correcteur de texte</h2>
            <p className="mt-1 text-sm text-muted-foreground">Analyse adaptée au niveau {level} : repérez les erreurs et comparez votre texte à une version corrigée.</p>
          </div>
          <div className="space-y-3">
            <Textarea
              placeholder="Écrivez votre texte en anglais ici…"
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="min-h-[160px] resize-y"
              disabled={loadingCheck}
            />
            <Button onClick={() => void handleCheck()} disabled={loadingCheck || !text.trim()} className="w-full">
              {loadingCheck ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyse en cours…</> : <><Sparkles className="mr-2 h-4 w-4" />Analyser mon texte</>}
            </Button>
          </div>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-y border-border py-4">
                <div><p className="text-sm text-muted-foreground">Score global</p><p className="text-3xl font-bold text-foreground">{result.overallScore}<span className="text-lg text-muted-foreground">/100</span></p></div>
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-lg', result.overallScore >= 80 ? 'bg-success/10 text-success' : result.overallScore >= 60 ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive')}>
                  {result.overallScore >= 80 ? <Check className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2">
                {Object.entries(result.categoryScores).map(([key, score]) => (
                  <div key={key}>
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-xs font-medium text-foreground">{categoryLabels[key] ?? key}</span><span className="text-xs font-bold text-foreground">{score}</span></div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                ))}
              </div>
              {result.mistakes.length > 0 && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Erreurs détectées</h3>
                  <div className="divide-y divide-border border-y border-border">
                    {result.mistakes.map((mistake) => (
                      <div key={mistake.id} className="py-3">
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{categoryLabels[mistake.category] ?? mistake.category}</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm text-destructive line-through">{mistake.originalText}</span><ArrowRight className="h-3 w-3 text-muted-foreground" /><span className="text-sm font-medium text-success">{mistake.correctedText}</span></div>
                        <p className="mt-1 text-xs text-muted-foreground">{mistake.explanation}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="border-y border-border py-3">
                <button type="button" onClick={() => setShowComparison((visible) => !visible)} className="flex w-full items-center justify-between text-sm font-semibold text-foreground">
                  Version corrigée<span className="text-xs font-medium text-primary">{showComparison ? 'Masquer' : 'Afficher'}</span>
                </button>
                {showComparison && <div className="mt-4 space-y-4"><div><p className="mb-1 text-xs font-semibold text-destructive">Votre texte</p><p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{result.originalText}</p></div><div><p className="mb-1 text-xs font-semibold text-success">Version corrigée</p><p className="rounded-md border border-success/20 bg-success/5 p-3 text-sm text-foreground">{result.improvedVersion}</p></div><div><p className="mb-1 text-xs font-semibold text-primary">Explication</p><p className="text-sm text-muted-foreground">{result.explanation}</p></div></div>}
              </div>
            </div>
          ) : !loadingCheck && (
            <div className="border-y border-dashed border-border py-8 text-center">
              <PenLine className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Votre analyse apparaîtra ici.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ExerciseCardProps {
  exercise: GrammarExercise;
  answer: string;
  feedback: GrammarExerciseFeedback | null;
  checking: boolean;
  onAnswer: (answer: string) => void;
  onCheck: () => void;
}

function ExerciseCard({ exercise, answer, feedback, checking, onAnswer, onCheck }: ExerciseCardProps) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-sm font-medium leading-6 text-foreground">{exercise.prompt}</p>
      {exercise.type === 'multiple_choice' ? (
        <fieldset className="mt-3 space-y-2">
          <legend className="sr-only">Choisissez une réponse</legend>
          {exercise.options?.map((option) => (
            <label key={option} className={cn(
              'flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
              answer === option ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/40',
            )}>
              <input
                type="radio"
                name={exercise.id}
                value={option}
                checked={answer === option}
                onChange={() => onAnswer(option)}
                className="mt-1 accent-primary"
              />
              <span>{option}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <Input
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          placeholder="Votre réponse en anglais"
          className="mt-3"
          aria-label={exercise.prompt}
        />
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={onCheck} disabled={!answer.trim() || checking}>
          {checking ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Vérification…</> : 'Vérifier'}
        </Button>
        {feedback && (
          <p aria-live="polite" className={cn('text-sm', feedback.correct ? 'text-success' : 'text-amber-700 dark:text-amber-300')}>
            {feedback.correct ? 'Bonne réponse.' : `Réponse attendue : ${feedback.answer}. `}{feedback.explanation}
          </p>
        )}
      </div>
    </div>
  );
}