import { useEffect, useState } from 'react';
import { TrendingUp, Clock, Flame, Award, Target, Sparkles, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProgressCard } from '@/components/shared/ProgressCard';
import { SkillCard } from '@/components/shared/SkillCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { WeeklyActivityChart, SkillRadialChart, CEFRProgressChart } from '@/components/progress/ProgressChart';
import { progressService } from '@/services/progress.service';
import type { ProgressOverview, StreakData, SkillScore } from '@/types/learning';
import { SKILL_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function ProgressPage() {
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [skills, setSkills] = useState<SkillScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      progressService.getOverview(),
      progressService.getStreak(),
      progressService.getSkillScores(),
    ]).then(([ov, st, sk]) => {
      setOverview(ov);
      setStreak(st);
      setSkills(sk);
      setLoading(false);
    });
  }, []);

  if (loading || !overview || !streak) return <LoadingState message="Chargement de vos progrès…" />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Vos progrès"
        subtitle="Suivez votre évolution et vos statistiques"
        icon={<TrendingUp className="h-5 w-5" />}
      />

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProgressCard title="Temps total" value={`${overview.totalMinutes} min`} subtitle={`${overview.totalLessons} leçons`} icon={<Clock className="h-5 w-5" />} />
        <ProgressCard title="Série actuelle" value={`${overview.currentStreak}j`} subtitle={`Record : ${overview.longestStreak}j`} icon={<Flame className="h-5 w-5" />} accent="warning" />
        <ProgressCard title="Cette semaine" value={`${overview.weeklyMinutes} min`} subtitle={`/ ${overview.weeklyGoal} min`} icon={<Target className="h-5 w-5" />} accent="accent" />
        <ProgressCard title="Niveau" value={overview.cefrProgression[overview.cefrProgression.length - 1]?.level ?? 'B1'} subtitle="En progression" icon={<Award className="h-5 w-5" />} accent="secondary" />
      </div>

      {/* Weekly activity chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Activité de la semaine</h2>
        <WeeklyActivityChart data={streak.weeklyActivity} />
      </div>

      {/* CEFR progression */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Progression CEFR</h2>
        <CEFRProgressChart data={overview.cefrProgression} />
      </div>

      {/* Skill scores */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Scores par compétence</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={skill.skill} skill={skill} />
          ))}
        </div>
      </div>

      {/* Skill radial chart */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Vue d'ensemble des compétences</h2>
        <SkillRadialChart skills={skills} />
      </div>

      {/* Recommendations */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Recommandations personnalisées</h2>
        <div className="space-y-2">
          {overview.recommendations.map((rec) => (
            <div
              key={rec.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30"
            >
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                rec.priority === 'high' ? 'bg-destructive/10 text-destructive' : rec.priority === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary',
              )}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{rec.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{rec.reason}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-primary">{SKILL_LABELS[rec.skill]}</span>
                  <span className="text-xs text-muted-foreground">· {rec.level}</span>
                  <span className="text-xs text-muted-foreground">· {rec.estimatedDuration} min</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent activities */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Activité récente</h2>
        <div className="space-y-2">
          {overview.recentActivities.map((act) => (
            <div key={act.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{act.title}</p>
                <p className="text-xs text-muted-foreground">{SKILL_LABELS[act.type]} · {act.duration} min</p>
              </div>
              {act.score && <span className="text-sm font-bold text-primary">{act.score}/100</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
