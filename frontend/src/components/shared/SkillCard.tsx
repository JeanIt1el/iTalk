import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { SkillScore } from '@/types/learning';
import { SKILL_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface SkillCardProps {
  skill: SkillScore;
  className?: string;
}

export function SkillCard({ skill, className }: SkillCardProps) {
  const TrendIcon = skill.trend === 'up' ? TrendingUp : skill.trend === 'down' ? TrendingDown : Minus;
  const trendColor = skill.trend === 'up' ? 'text-success' : skill.trend === 'down' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{SKILL_LABELS[skill.skill]}</span>
        <TrendIcon className={cn('h-4 w-4', trendColor)} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-foreground">{skill.score}</span>
        <span className="mb-0.5 text-xs text-muted-foreground">/ 100</span>
      </div>
      <Progress value={skill.progress} className="h-1.5" />
      <span className="text-[0.7rem] text-muted-foreground">
        Niveau {skill.level} · {skill.progress}% de progression
      </span>
    </div>
  );
}
