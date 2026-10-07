import { Check, X, Info } from 'lucide-react';
import type { ConversationCorrection } from '@/types/conversation';
import { cn } from '@/lib/utils';

const typeLabels: Record<ConversationCorrection['type'], string> = {
  grammar: 'Grammaire',
  vocabulary: 'Vocabulaire',
  pronunciation: 'Prononciation',
  syntax: 'Syntaxe',
};

interface CorrectionCardProps {
  correction: ConversationCorrection;
  className?: string;
}

export function CorrectionCard({ correction, className }: CorrectionCardProps) {
  return (
    <div className={cn('rounded-lg border border-amber-300/50 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10 p-3 animate-fade-in', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-800/40 dark:text-amber-200">
          {typeLabels[correction.type]}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <X className="h-3.5 w-3.5 text-destructive shrink-0" />
          <span className="text-sm text-destructive line-through decoration-destructive/50">{correction.originalText}</span>
        </div>
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-success shrink-0" />
          <span className="text-sm font-medium text-success">{correction.correctedText}</span>
        </div>
      </div>
      <div className="mt-2 flex items-start gap-1.5">
        <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">{correction.explanation}</p>
      </div>
    </div>
  );
}
