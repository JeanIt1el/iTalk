import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  audioUrl: string | null;
  title?: string;
  className?: string;
}

export function AudioPlayer({ audioUrl, title = 'Audio ambient', className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return p + 0.5;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const formatTime = (pct: number) => {
    const totalSec = 180; // mock 3 min
    const current = Math.floor((pct / 100) * totalSec);
    const m = Math.floor(current / 60);
    const s = current % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex items-center gap-3 rounded-xl border border-border bg-card p-3', className)}>
      <button
        onClick={() => setIsPlaying((p) => !p)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        disabled={!audioUrl}
        aria-label={isPlaying ? 'Pause' : 'Lecture'}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
      </button>

      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            {title}
          </span>
          <span className="text-[0.7rem] text-muted-foreground tabular-nums">
            {formatTime(progress)} / 3:00
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => {
          setProgress(0);
          setIsPlaying(false);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Recommencer"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
