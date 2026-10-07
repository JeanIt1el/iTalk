import { Type } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadingTextSizeControlsProps {
  size: 'small' | 'medium' | 'large';
  onChange: (size: 'small' | 'medium' | 'large') => void;
  className?: string;
}

const sizes: { value: 'small' | 'medium' | 'large'; label: string; px: string }[] = [
  { value: 'small', label: 'A', px: 'text-sm' },
  { value: 'medium', label: 'A', px: 'text-base' },
  { value: 'large', label: 'A', px: 'text-lg' },
];

export function ReadingTextSizeControls({ size, onChange, className }: ReadingTextSizeControlsProps) {
  return (
    <div className={cn('flex items-center gap-1 rounded-lg border border-border bg-card p-1', className)}>
      <Type className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
      {sizes.map((s, idx) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            size === s.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            idx === 0 && 'text-xs',
            idx === 1 && 'text-sm',
            idx === 2 && 'text-base',
          )}
          aria-label={`Taille de texte ${s.value}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
