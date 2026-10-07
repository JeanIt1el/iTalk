import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ProgressCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  accent?: 'primary' | 'secondary' | 'accent' | 'warning';
  className?: string;
}

const accentMap = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function ProgressCard({ title, value, subtitle, icon, accent = 'primary', className }: ProgressCardProps) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-4', className)}>
      {icon && (
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accentMap[accent])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {subtitle && <p className="text-[0.7rem] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
