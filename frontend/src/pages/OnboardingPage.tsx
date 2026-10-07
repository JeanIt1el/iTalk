import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Sparkles, Plane, Briefcase, GraduationCap, Coffee, Award, Globe } from 'lucide-react';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { TopicChip } from '@/components/shared/TopicChip';
import { LevelBadge } from '@/components/shared/LevelBadge';
import {
  CEFR_LEVELS,
  TARGET_LANGUAGES,
  LEARNING_GOALS,
  LEARNING_PACES,
  INTEREST_OPTIONS,
} from '@/lib/constants';
import type { CEFRLevel, LearningGoal, LearningPace, TargetLanguage } from '@/types/user';
import { cn } from '@/lib/utils';

const goalIcons: Record<string, typeof Plane> = {
  travel: Plane,
  work: Briefcase,
  study: GraduationCap,
  daily: Coffee,
  exam: Award,
  culture: Globe,
};

const TOTAL_STEPS = 5;

export function OnboardingPage() {
  const navigate = useNavigate();
  const { data, step, setStep, updateData } = useOnboardingStore();
  const { updateUser } = useAuthStore();
  const [name, setName] = useState(data.name ?? '');
  const [selectedGoals, setSelectedGoals] = useState<LearningGoal[]>(data.goals ?? []);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(data.interests ?? []);

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return !!data.targetLanguage;
      case 2: return !!data.cefrLevel;
      case 3: return selectedGoals.length > 0;
      case 4: return true;
      default: return true;
    }
  };

  const handleNext = () => {
    if (step === 0) updateData({ name });
    if (step === 3) updateData({ goals: selectedGoals, interests: selectedInterests });

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
    } else {
      updateUser({
        name,
        targetLanguage: data.targetLanguage ?? 'en',
        cefrLevel: data.cefrLevel ?? 'B1',
        goals: selectedGoals,
        interests: selectedInterests,
        pace: data.pace ?? 'regular',
        dailyGoalMinutes: data.dailyGoalMinutes ?? 20,
      });
      navigate('/home');
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress bar */}
      <div className="safe-top px-6 pt-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold">iTalk</span>
        </div>
        <div className="mt-6 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all',
                i <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 py-8">
        {/* Step 0: Name */}
        {step === 0 && (
          <div className="flex flex-1 flex-col justify-center gap-6 animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Bienvenue sur iTalk</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Apprenez les langues avec une IA conversationnelle. Commençons par faire connaissance.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Comment vous appelez-vous ?</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre prénom"
                onKeyDown={(e) => e.key === 'Enter' && canProceed() && handleNext()}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Step 1: Target language */}
        {step === 1 && (
          <div className="flex flex-1 flex-col justify-center gap-6 animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Quelle langue souhaitez-vous apprendre ?</h1>
              <p className="mt-2 text-sm text-muted-foreground">Choisissez votre langue cible.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TARGET_LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => updateData({ targetLanguage: lang.value })}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    data.targetLanguage === lang.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  <span className="text-2xl">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                  {data.targetLanguage === lang.value && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: CEFR level */}
        {step === 2 && (
          <div className="flex flex-1 flex-col justify-center gap-6 animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Quel est votre niveau ?</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Évaluez votre niveau actuel selon le cadre européen (CECRL).
              </p>
            </div>
            <div className="space-y-2">
              {CEFR_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => updateData({ cefrLevel: level.value as CEFRLevel })}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    data.cefrLevel === level.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  <LevelBadge level={level.value} size="md" />
                  <div className="flex-1">
                    <p className="font-medium">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </div>
                  {data.cefrLevel === level.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Goals & interests */}
        {step === 3 && (
          <div className="flex flex-1 flex-col justify-center gap-6 animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vos objectifs</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Pourquoi apprenez-vous cette langue ? Sélectionnez un ou plusieurs objectifs.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {LEARNING_GOALS.map((goal) => {
                const Icon = goalIcons[goal.icon] ?? Sparkles;
                const isSelected = selectedGoals.includes(goal.value);
                return (
                  <button
                    key={goal.value}
                    onClick={() => {
                      setSelectedGoals((prev) =>
                        isSelected ? prev.filter((g) => g !== goal.value) : [...prev, goal.value],
                      );
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border-2 p-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30',
                    )}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">{goal.label}</span>
                    {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Vos centres d'intérêt</p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((interest) => (
                  <TopicChip
                    key={interest}
                    label={interest}
                    selected={selectedInterests.includes(interest)}
                    onClick={() => {
                      setSelectedInterests((prev) =>
                        prev.includes(interest)
                          ? prev.filter((i) => i !== interest)
                          : [...prev, interest],
                      );
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Pace & daily goal */}
        {step === 4 && (
          <div className="flex flex-1 flex-col justify-center gap-6 animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Votre rythme d'apprentissage</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Définissez votre objectif quotidien pour construire une habitude durable.
              </p>
            </div>
            <div className="space-y-2">
              {LEARNING_PACES.map((pace) => (
                <button
                  key={pace.value}
                  onClick={() => {
                    updateData({ pace: pace.value as LearningPace, dailyGoalMinutes: pace.minutesPerDay });
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    data.pace === pace.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  <div className="flex-1">
                    <p className="font-medium">{pace.label}</p>
                    <p className="text-xs text-muted-foreground">{pace.description}</p>
                  </div>
                  {data.pace === pace.value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <Label>Objectif quotidien</Label>
                <span className="text-sm font-bold text-primary">{data.dailyGoalMinutes} min/jour</span>
              </div>
              <Slider
                value={[data.dailyGoalMinutes ?? 20]}
                onValueChange={(val) => updateData({ dailyGoalMinutes: val[0] })}
                min={5}
                max={60}
                step={5}
                className="mt-3"
              />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 px-6 pb-8 safe-bottom">
        {step > 0 && (
          <Button variant="outline" onClick={handleBack} size="lg" className="flex-1">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        )}
        <Button onClick={handleNext} disabled={!canProceed()} size="lg" className="flex-1">
          {step === TOTAL_STEPS - 1 ? 'Commencer' : 'Continuer'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
