import { cn } from '@/lib/utils';

interface WaveformPlaceholderProps {
  isActive: boolean;
  className?: string;
}

export function WaveformPlaceholder({ isActive, className }: WaveformPlaceholderProps) {
  const bars = [0.3, 0.6, 0.9, 0.5, 0.8, 0.4, 0.7, 0.3, 0.6, 0.9, 0.5, 0.7, 0.4, 0.8, 0.3, 0.6, 0.5, 0.9, 0.4, 0.7];

  return (
    <div className={cn('flex items-center justify-center gap-1 h-16', className)}>
      {bars.map((height, idx) => (
        <div
          key={idx}
          className={cn(
            'w-1.5 rounded-full transition-all',
            isActive ? 'bg-primary animate-waveform' : 'bg-muted-foreground/30',
          )}
          style={{
            height: `${height * 100}%`,
            animationDelay: `${idx * 60}ms`,
            animationPlayState: isActive ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}
