import { useState, useCallback } from 'react';
import { Volume2, Eye, EyeOff, RotateCw } from 'lucide-react';
import type { VocabularyItem, SrsRating } from '@/types/learning';
import { cn } from '@/lib/utils';

interface VocabularyFlashcardProps {
  item: VocabularyItem;
  onRate: (rating: SrsRating) => void;
  className?: string;
}

const ratingButtons: { value: SrsRating; label: string; color: string }[] = [
  { value: 'again', label: 'À revoir', color: 'bg-destructive text-destructive-foreground' },
  { value: 'hard', label: 'Difficile', color: 'bg-amber-500 text-white' },
  { value: 'good', label: 'Correct', color: 'bg-blue-500 text-white' },
  { value: 'easy', label: 'Facile', color: 'bg-success text-success-foreground' },
];

export function VocabularyFlashcard({ item, onRate, className }: VocabularyFlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = useCallback(() => setFlipped((f) => !f), []);

  return (
    <div className={cn('flex flex-col', className)}>
      <button
        onClick={handleFlip}
        className="relative mx-auto h-72 w-full max-w-sm cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
        style={{ perspective: '1000px' }}
        aria-label="Retourner la carte"
      >
        <div
          className="relative h-full w-full transition-transform duration-500"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {item.partOfSpeech}
            </span>
            <h3 className="text-3xl font-bold text-foreground">{item.word}</h3>
            <p className="text-sm text-muted-foreground">{item.phonetic}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                Niveau {item.srsLevel}/5
              </span>
            </div>
            <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <Eye className="h-3 w-3" /> Appuyez pour retourner
            </span>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-sm"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <h3 className="text-2xl font-bold text-primary">{item.translation}</h3>
            <p className="text-sm italic text-muted-foreground">{item.example}</p>
            <p className="text-xs text-muted-foreground">{item.exampleTranslation}</p>
            <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <EyeOff className="h-3 w-3" /> Appuyez pour retourner
            </span>
          </div>
        </div>
      </button>

      {flipped && (
        <div className="mt-4 grid grid-cols-4 gap-2 animate-fade-in">
          {ratingButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => {
                onRate(btn.value);
                setFlipped(false);
              }}
              className={cn(
                'rounded-lg px-2 py-2 text-xs font-medium transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                btn.color,
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {/* TODO: TTS */}}
        >
          <Volume2 className="h-3.5 w-3.5" /> Écouter
        </button>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={handleFlip}
        >
          <RotateCw className="h-3.5 w-3.5" /> Retourner
        </button>
      </div>
    </div>
  );
}
