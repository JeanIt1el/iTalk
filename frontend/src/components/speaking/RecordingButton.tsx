import { useState, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecordingState = 'idle' | 'recording' | 'processing';

interface RecordingButtonProps {
  onRecordingComplete: () => void;
  className?: string;
}

export function RecordingButton({ onRecordingComplete, className }: RecordingButtonProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (state === 'recording') {
      interval = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state]);

  const handleStart = useCallback(() => {
    setState('recording');
    setDuration(0);
  }, []);

  const handleStop = useCallback(() => {
    setState('processing');
    setTimeout(() => {
      setState('idle');
      setDuration(0);
      onRecordingComplete();
    }, 2000);
  }, [onRecordingComplete]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {state === 'recording' && (
        <span className="text-sm font-medium tabular-nums text-destructive animate-pulse-soft">
          {formatDuration(duration)}
        </span>
      )}
      <button
        onClick={state === 'idle' ? handleStart : state === 'recording' ? handleStop : undefined}
        disabled={state === 'processing'}
        className={cn(
          'flex h-20 w-20 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30',
          state === 'idle' && 'bg-primary text-primary-foreground hover:scale-105 shadow-lg shadow-primary/20',
          state === 'recording' && 'bg-destructive text-destructive-foreground animate-pulse-soft',
          state === 'processing' && 'bg-muted text-muted-foreground',
        )}
        aria-label={state === 'recording' ? 'Arrêter l\'enregistrement' : 'Commencer l\'enregistrement'}
      >
        {state === 'processing' ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : state === 'recording' ? (
          <Square className="h-7 w-7 fill-current" />
        ) : (
          <Mic className="h-8 w-8" />
        )}
      </button>
      <span className="text-xs text-muted-foreground">
        {state === 'idle' && 'Appuyez pour parler'}
        {state === 'recording' && 'Enregistrement… appuyez pour arrêter'}
        {state === 'processing' && 'Analyse en cours…'}
      </span>
    </div>
  );
}
