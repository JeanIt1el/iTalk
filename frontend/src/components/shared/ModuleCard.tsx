import { Link } from 'react-router-dom';
import { Clock, Lock, CheckCircle2, PlayCircle } from 'lucide-react';
import type { LearningModule } from '@/types/learning';
import { LevelBadge } from './LevelBadge';
import { SKILL_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const colorMap: Record<string, string> = {
  primary: 'from-primary/15 to-primary/5 text-primary',
  secondary: 'from-secondary/15 to-secondary/5 text-secondary',
  accent: 'from-accent/15 to-accent/5 text-accent',
  warning: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
};

interface ModuleCardProps {
  module: LearningModule;
  className?: string;
}

export function ModuleCard({ module, className }: ModuleCardProps) {
  const isComplete = module.progress === 100;
  const isStarted = module.progress > 0 && module.progress < 100;

  return (
    <Link
      to={`/modules?id=${module.id}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        module.isLocked && 'opacity-60',
        className,
      )}
    >
      <div className={cn('relative flex h-24 items-center justify-between bg-gradient-to-br px-4', colorMap[module.thumbnailColor] ?? colorMap.primary)}>
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide opacity-70">
            {SKILL_LABELS[module.skill]}
          </span>
          <span className="text-sm font-semibold">{module.topic}</span>
        </div>
        <div className="flex items-center gap-2">
          {module.isLocked ? (
            <Lock className="h-5 w-5 opacity-50" />
          ) : isComplete ? (
            <CheckCircle2 className="h-6 w-6 text-success" />
          ) : (
            <PlayCircle className="h-6 w-6 opacity-70 transition-transform group-hover:scale-110" />
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="font-semibold leading-snug text-foreground">{module.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{module.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <LevelBadge level={module.level} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {module.durationMinutes} min
          </span>
          <span className="text-xs text-muted-foreground">
            · {module.completedLessons}/{module.lessonsCount} leçons
          </span>
        </div>

        {(isStarted || isComplete) && (
          <div className="mt-auto">
            <Progress value={module.progress} className="h-1.5" />
            <span className="mt-1 block text-[0.65rem] text-muted-foreground">
              {module.progress}% complété
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
