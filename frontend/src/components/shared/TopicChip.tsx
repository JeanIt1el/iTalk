import { cn } from '@/lib/utils';

interface TopicChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TopicChip({ label, selected, onClick, className }: TopicChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
        className,
      )}
    >
      {label}
    </button>
  );
}
