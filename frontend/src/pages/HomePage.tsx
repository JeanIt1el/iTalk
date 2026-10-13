import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Target, Clock, TrendingUp, MessageCircle, PenLine, Mic, Sparkles, ChevronRight, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProgressCard } from '@/components/shared/ProgressCard';
import { ModuleCard } from '@/components/shared/ModuleCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/stores/useAuthStore';
import { progressService } from '@/services/progress.service';
import { learningService } from '@/services/learning.service';
import type { ProgressOverview } from '@/types/learning';
import type { LearningModule } from '@/types/learning';
import { SKILL_LABELS } from '@/lib/constants';

const skillIcons: Record<string, typeof MessageCircle> = {
  conversation: MessageCircle,
  grammar: PenLine,
  speaking: Mic,
};

const skillPaths: Record<string, string> = {
  conversation: '/conversation',
  grammar: '/grammar',
  speaking: '/speaking',
};

export function HomePage() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      progressService.getOverview(),
      learningService.getModules(),
    ]).then(([ov, modResult]) => {
      setOverview(ov);
      setModules(modResult.modules.slice(0, 3));
      setLoading(false);
    });
  }, []);

  if (loading || !overview) return <LoadingState message="Chargement de votre tableau de bord…" />;

  const firstName = user?.name?.split(' ')[0] ?? '';
  const dailyProgress = Math.min((overview.weeklyMinutes / overview.weeklyGoal) * 100, 100);
  const recommendedModules = modules.filter((m) => m.progress < 100).slice(0, 2);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Bonjour, ${firstName}`}
        subtitle="Prêt pour votre session du jour ?"
      />

      {/* Daily goal card */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Objectif quotidien</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{user?.dailyGoalMinutes} min</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 border border-border">
            <Flame className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold">{overview.currentStreak} jours</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{overview.weeklyMinutes} min cette semaine</span>
            <span>{overview.weeklyGoal} min objectif</span>
          </div>
          <Progress value={dailyProgress} className="h-2" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProgressCard
          title="Série"
          value={`${overview.currentStreak}j`}
          subtitle={`Record : ${overview.longestStreak}j`}
          icon={<Flame className="h-5 w-5" />}
          accent="warning"
        />
        <ProgressCard
          title="Total"
          value={`${overview.totalMinutes} min`}
          subtitle={`${overview.totalLessons} leçons`}
          icon={<Clock className="h-5 w-5" />}
        />
        <ProgressCard
          title="Cette semaine"
          value={`${overview.weeklyMinutes} min`}
          subtitle={`${Math.round(dailyProgress)}% de l'objectif`}
          icon={<Calendar className="h-5 w-5" />}
          accent="accent"
        />
        <ProgressCard
          title="Niveau"
          value={user?.cefrLevel ?? 'B1'}
          subtitle="En progression"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="secondary"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Accès rapide</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(['conversation', 'grammar', 'speaking'] as const).map((skill) => {
            const Icon = skillIcons[skill];
            return (
              <Link
                key={skill}
                to={skillPaths[skill]}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{SKILL_LABELS[skill]}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recommendation */}
      {overview.recommendations.length > 0 && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Recommandé pour vous</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{overview.recommendations[0].reason}</p>
              <Link to={skillPaths[overview.recommendations[0].skill] ?? '/modules'}>
                <Button size="sm" variant="default" className="mt-3">
                  {overview.recommendations[0].title}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Continue learning */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Continuer l'apprentissage</h2>
          <Link to="/modules" className="text-xs text-primary hover:underline">
            Tout voir
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {recommendedModules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Activité récente</h2>
        <div className="space-y-2">
          {overview.recentActivities.slice(0, 4).map((act) => {
            const Icon = skillIcons[act.type] ?? MessageCircle;
            return (
              <div key={act.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{act.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {SKILL_LABELS[act.type]} · {act.duration} min
                  </p>
                </div>
                {act.score && (
                  <span className="text-sm font-bold text-primary">{act.score}/100</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
