import { cn } from '@/lib/utils';
import type { CEFRLevel } from '@/types/user';

interface LevelBadgeProps {
  level: CEFRLevel;
  className?: string;
  size?: 'sm' | 'md';
}

const levelColors: Record<CEFRLevel, string> = {
  A1: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  A2: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  B1: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  B2: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  C1: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  C2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

export function LevelBadge({ level, className, size = 'sm' }: LevelBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-bold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[0.65rem]' : 'px-2 py-1 text-xs',
        levelColors[level],
        className,
      )}
    >
      {level}
    </span>
  );
}
