import { useState } from 'react';
import { Mic, CheckCircle2, AlertCircle, TrendingUp, Volume2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { RecordingButton } from '@/components/speaking/RecordingButton';
import { WaveformPlaceholder } from '@/components/speaking/WaveformPlaceholder';
import { LoadingState } from '@/components/shared/LoadingState';
import { speechService } from '@/services/speech.service';
import { useToast } from '@/hooks/use-toast';
import type { SpeechRecording, PronunciationFeedback } from '@/types/conversation';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const promptTexts = [
  "I'd like to book a table for two at seven o'clock, please.",
  "Could you tell me how to get to the train station?",
  "I'm looking forward to our meeting next Tuesday.",
  "The weather has been really nice this week, hasn't it?",
];

export function SpeakingPage() {
  const { toast } = useToast();
  const [recording, setRecording] = useState<SpeechRecording | null>(null);
  const [feedback, setFeedback] = useState<PronunciationFeedback | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [promptIndex, setPromptIndex] = useState(0);

  const handleRecordingComplete = async () => {
    setLoading(true);
    try {
      const rec = await speechService.stopRecording(`rec-${Date.now()}`);
      setRecording(rec);
      setFeedback(rec.feedback);
      toast('Analyse terminée !', { variant: 'success' });
    } catch {
      toast('Erreur lors de l\'analyse', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-success' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-destructive';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Expression orale"
        subtitle="Pratiquez votre prononciation avec l'IA"
        icon={<Mic className="h-5 w-5" />}
      />

      {/* Prompt */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Phrase à prononcer</p>
        <p className="text-lg font-medium text-foreground leading-relaxed">
          « {promptTexts[promptIndex]} »
        </p>
        <button
          onClick={() => setPromptIndex((i) => (i + 1) % promptTexts.length)}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Changer de phrase
        </button>
      </div>

      {/* Recording */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <WaveformPlaceholder isActive={isRecording} className="mb-4" />
        <RecordingButton
          onRecordingComplete={handleRecordingComplete}
          className="py-2"
        />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Autorisez l'accès au microphone pour commencer
        </p>
      </div>

      {/* Loading */}
      {loading && <LoadingState message="Analyse de votre prononciation…" />}

      {/* Results */}
      {feedback && recording && !loading && (
        <div className="space-y-4 animate-fade-in-up">
          {/* Overall score */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score de prononciation</p>
                <p className={cn('text-3xl font-bold', scoreColor(feedback.overallScore))}>
                  {feedback.overallScore}<span className="text-lg text-muted-foreground">/100</span>
                </p>
              </div>
              <div className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                feedback.overallScore >= 80 ? 'bg-success/10 text-success' : 'bg-amber-500/10 text-amber-600',
              )}>
                {feedback.overallScore >= 80 ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
              </div>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Fluidité', value: feedback.fluency },
              { label: 'Précision', value: feedback.accuracy },
              { label: 'Rythme', value: feedback.pacing },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border bg-card p-3 text-center">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={cn('text-xl font-bold', scoreColor(item.value))}>{item.value}</p>
                <Progress value={item.value} className="mt-1.5 h-1" />
              </div>
            ))}
          </div>

          {/* Transcript */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Transcription</p>
            <p className="text-sm text-foreground">{recording.transcript}</p>
          </div>

          {/* Issues */}
          {feedback.issues.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-amber-600 dark:text-amber-400">Points à améliorer</h3>
              <div className="space-y-2">
                {feedback.issues.map((issue, idx) => (
                  <div key={idx} className="rounded-lg border border-amber-300/50 bg-amber-50 dark:border-amber-700/40 dark:bg-amber-900/10 p-3">
                    <p className="text-sm font-medium text-foreground">« {issue.word} »</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{issue.issue}</p>
                    <p className="mt-1 text-xs text-primary">💡 {issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths */}
          {feedback.strengths.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-success">Points forts</h3>
              <div className="space-y-1.5">
                {feedback.strengths.map((s, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!feedback && !loading && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Mic className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Appuyez sur le bouton pour enregistrer votre voix et obtenir un feedback.
          </p>
        </div>
      )}
    </div>
  );
}
