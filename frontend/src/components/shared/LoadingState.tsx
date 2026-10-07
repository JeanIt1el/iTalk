import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = 'Chargement…', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function LoadingCard({ className }: { className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
      <div className="h-24 bg-muted shimmer" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-muted shimmer" />
        <div className="h-3 w-full rounded bg-muted shimmer" />
        <div className="h-3 w-1/2 rounded bg-muted shimmer" />
      </div>
    </div>
  );
}
