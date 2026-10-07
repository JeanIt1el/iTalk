import { CheckCircle2, AlertCircle, BookOpen, Clock, MessageSquare, Star } from 'lucide-react';
import type { ConversationSummary } from '@/types/conversation';

interface SessionSummaryProps {
  summary: ConversationSummary;
  onRestart?: () => void;
  onClose?: () => void;
}

export function SessionSummary({ summary, onRestart, onClose }: SessionSummaryProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 animate-scale-in">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Star className="h-7 w-7" />
        </div>
        <h3 className="mt-3 text-lg font-bold">Session terminée !</h3>
        <p className="text-sm text-muted-foreground">Voici votre récapitulatif</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-bold">{summary.duration}</span>
          <span className="text-[0.65rem] text-muted-foreground">minutes</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-bold">{summary.messagesExchanged}</span>
          <span className="text-[0.65rem] text-muted-foreground">messages</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-xl bg-muted/50 p-3">
          <Star className="h-4 w-4 text-muted-foreground" />
          <span className="text-lg font-bold">{summary.overallScore}</span>
          <span className="text-[0.65rem] text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" />
          Points forts
        </h4>
        <ul className="mt-2 space-y-1.5">
          {summary.strengths.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-success" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          À améliorer
        </h4>
        <ul className="mt-2 space-y-1.5">
          {summary.areasToImprove.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {summary.newVocabulary.length > 0 && (
        <div>
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <BookOpen className="h-4 w-4" />
            Nouveaux mots
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {summary.newVocabulary.map((v, i) => (
              <div key={i} className="rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                <p className="text-sm font-medium text-foreground">{v.word}</p>
                <p className="text-xs text-muted-foreground">{v.translation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {onRestart && (
          <button
            onClick={onRestart}
            className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Nouvelle session
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
