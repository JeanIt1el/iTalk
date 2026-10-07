import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Settings, Flame, Clock, Award, Target, ChevronRight, Edit3, Globe } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProgressCard } from '@/components/shared/ProgressCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/useAuthStore';
import { progressService } from '@/services/progress.service';
import type { ProgressOverview } from '@/types/learning';
import { TARGET_LANGUAGES, LEARNING_GOALS } from '@/lib/constants';

export function ProfilePage() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    progressService.getOverview().then((ov) => {
      setOverview(ov);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState message="Chargement du profil…" />;
  if (!user) return null;

  const initials = user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const targetLang = TARGET_LANGUAGES.find((l) => l.value === user.targetLanguage);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="Profil" />

      {/* Profile header */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <Avatar className="h-16 w-16 border-2 border-primary/20">
          <AvatarFallback className="bg-primary/10 text-lg font-bold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {targetLang?.flag} {targetLang?.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Niveau {user.cefrLevel}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="icon" asChild>
          <Link to="/settings">
            <Edit3 className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProgressCard title="Série" value={`${overview!.currentStreak}j`} subtitle={`Record ${overview!.longestStreak}j`} icon={<Flame className="h-5 w-5" />} accent="warning" />
        <ProgressCard title="Temps total" value={`${overview!.totalMinutes} min`} icon={<Clock className="h-5 w-5" />} />
        <ProgressCard title="Leçons" value={overview!.totalLessons} icon={<Award className="h-5 w-5" />} accent="secondary" />
        <ProgressCard title="Objectif" value={`${user.dailyGoalMinutes} min`} subtitle="par jour" icon={<Target className="h-5 w-5" />} accent="accent" />
      </div>

      {/* Goals */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Mes objectifs</h3>
        <div className="flex flex-wrap gap-2">
          {user.goals.map((goalId) => {
            const goal = LEARNING_GOALS.find((g) => g.value === goalId);
            return (
              <Badge key={goalId} variant="outline" className="text-xs">
                {goal?.label ?? goalId}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Interests */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Centres d'intérêt</h3>
        <div className="flex flex-wrap gap-2">
          {user.interests.map((interest) => (
            <Badge key={interest} variant="secondary" className="text-xs">
              {interest}
            </Badge>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-2">
        <Link to="/settings" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Paramètres</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link to="/progress" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Award className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-medium">Voir mes progrès détaillés</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
