import { cn } from '@/lib/utils';

interface ResponseSuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  className?: string;
}

export function ResponseSuggestions({ suggestions, onSelect, className }: ResponseSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary transition-all hover:bg-primary/10 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
