import { useState } from 'react';
import { PenLine, Check, AlertCircle, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { learningService } from '@/services/learning.service';
import { useToast } from '@/hooks/use-toast';
import type { GrammarResult } from '@/types/learning';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  spelling: 'Orthographe',
  grammar: 'Grammaire',
  punctuation: 'Ponctuation',
  word_choice: 'Choix de mots',
  syntax: 'Syntaxe',
};

export function GrammarPage() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [result, setResult] = useState<GrammarResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const handleCheck = async () => {
    if (!text.trim()) {
      toast('Veuillez écrire un texte à analyser', { variant: 'warning' });
      return;
    }
    setLoading(true);
    setResult(null);
    setShowComparison(false);
    try {
      const res = await learningService.checkGrammar(text);
      setResult(res);
      toast(`${res.mistakes.length} erreur${res.mistakes.length > 1 ? 's' : ''} détectée${res.mistakes.length > 1 ? 's' : ''}`, {
        variant: res.mistakes.length > 0 ? 'warning' : 'success',
      });
    } catch {
      toast('Erreur lors de l\'analyse', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Grammaire & Écriture"
        subtitle="Corrigez vos textes avec l'IA"
        icon={<PenLine className="h-5 w-5" />}
      />

      {/* Editor */}
      <div className="space-y-3">
        <Textarea
          placeholder="Écrivez votre texte en anglais ici… L'IA détectera les erreurs et proposera des corrections."
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-[160px] resize-y"
          disabled={loading}
        />
        <Button onClick={handleCheck} disabled={loading || !text.trim()} className="w-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyser mon texte
            </>
          )}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Score */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score global</p>
                <p className="text-3xl font-bold text-foreground">{result.overallScore}<span className="text-lg text-muted-foreground">/100</span></p>
              </div>
              <div className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                result.overallScore >= 80 ? 'bg-success/10 text-success' : result.overallScore >= 60 ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive',
              )}>
                {result.overallScore >= 80 ? <Check className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{result.mistakes.length} erreur{result.mistakes.length > 1 ? 's' : ''} détectée{result.mistakes.length > 1 ? 's' : ''}</p>
          </div>

          {/* Category scores */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(result.categoryScores).map(([key, score]) => (
              <div key={key} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-foreground">{categoryLabels[key] ?? key}</span>
                  <span className="text-sm font-bold text-foreground">{score}</span>
                </div>
                <Progress value={score} className="h-1.5" />
              </div>
            ))}
          </div>

          {/* Mistakes */}
          {result.mistakes.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Erreurs détectées</h3>
              <div className="space-y-2">
                {result.mistakes.map((mistake) => (
                  <div key={mistake.id} className="rounded-lg border border-amber-300/50 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10 p-3">
                    <span className="inline-flex items-center rounded-md bg-amber-200/60 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800 dark:bg-amber-800/40 dark:text-amber-200 mb-2">
                      {categoryLabels[mistake.category] ?? mistake.category}
                    </span>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-destructive line-through">{mistake.originalText}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm font-medium text-success">{mistake.correctedText}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{mistake.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparison toggle */}
          <div className="rounded-xl border border-border bg-card p-4">
            <button
              onClick={() => setShowComparison((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-sm font-semibold text-foreground">Version corrigée</span>
              <span className="text-xs text-primary">{showComparison ? 'Masquer' : 'Afficher'}</span>
            </button>
            {showComparison && (
              <div className="mt-3 space-y-3 animate-fade-in">
                <div>
                  <p className="mb-1 text-xs font-semibold text-destructive">Votre texte</p>
                  <p className="text-sm text-muted-foreground rounded-lg bg-muted/50 p-3">{result.originalText}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-success">Version corrigée</p>
                  <p className="text-sm text-foreground rounded-lg bg-success/5 border border-success/20 p-3">{result.improvedVersion}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Explication</p>
                  <p className="text-sm text-muted-foreground">{result.explanation}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <PenLine className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Écrivez un texte et cliquez sur « Analyser » pour obtenir des corrections.
          </p>
        </div>
      )}
    </div>
  );
}
