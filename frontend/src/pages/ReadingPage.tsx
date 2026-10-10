import { useEffect, useRef, useState } from 'react';
import { BookOpen, Clock, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { LevelBadge } from '@/components/shared/LevelBadge';
import { ReadingTextSizeControls } from '@/components/reading/ReadingTextSizeControls';
import { DifficultWordSheet } from '@/components/reading/DifficultWordSheet';
import { AudioPlayer } from '@/components/reading/AudioPlayer';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { learningService } from '@/services/learning.service';
import type { ReadingText } from '@/types/learning';
import { cn } from '@/lib/utils';

const textSizeMap = {
  small: 'text-sm leading-relaxed',
  medium: 'text-base leading-relaxed',
  large: 'text-lg leading-relaxed',
};

export function ReadingPage() {
  const [texts, setTexts] = useState<ReadingText[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedText, setSelectedText] = useState<ReadingText | null>(null);
  const [textSize, setTextSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [readingProgress, setReadingProgress] = useState(0);
  const readingStartedAt = useRef<number>(0);

  useEffect(() => {
    learningService.getReadingTexts().then((result) => {
      setTexts(result);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedText) {
      setReadingProgress(0);
    }
  }, [selectedText]);

  useEffect(() => {
    if (!selectedText || !readingStartedAt.current) return;
    const timer = window.setTimeout(() => {
      void learningService.updateReadingProgress({
        textId: selectedText.id,
        progress: Math.round(readingProgress),
        timeSpent: Math.floor((Date.now() - readingStartedAt.current) / 1000),
        wordsRead: Math.floor(selectedText.wordCount * readingProgress / 100),
        isCompleted: readingProgress >= 100,
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [selectedText, readingProgress]);

  const saveCurrentProgress = () => {
    if (!selectedText) return;
    void learningService.updateReadingProgress({
      textId: selectedText.id,
      progress: Math.round(readingProgress),
      timeSpent: Math.floor((Date.now() - readingStartedAt.current) / 1000),
      wordsRead: Math.floor(selectedText.wordCount * readingProgress / 100),
      isCompleted: readingProgress >= 100,
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    if (max > 0) {
      setReadingProgress(Math.min((el.scrollTop / max) * 100, 100));
    }
  };

  if (loading) return <LoadingState message="Chargement des textes…" />;

  if (selectedText) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { saveCurrentProgress(); setSelectedText(null); }}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Retour
          </Button>
          <ReadingTextSizeControls size={textSize} onChange={setTextSize} />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{selectedText.title}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">par {selectedText.author}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LevelBadge level={selectedText.level} size="md" />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {selectedText.estimatedReadingTime} min
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DifficultWordSheet words={selectedText.difficultWords} />
          {readingProgress >= 100 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Lecture terminée !
            </span>
          )}
        </div>

        <Progress value={readingProgress} className="h-1" />

        <div
          onScroll={handleScroll}
          className="max-h-[calc(100vh-18rem)] overflow-y-auto rounded-xl border border-border bg-card p-5 scrollbar-hide"
        >
          <div className={cn('prose prose-sm dark:prose-invert max-w-none', textSizeMap[textSize])}>
            {selectedText.content.split('\n\n').map((para, idx) => (
              <p key={idx} className="mb-4 text-foreground">
                {para}
              </p>
            ))}
          </div>
        </div>

        <AudioPlayer audioUrl={selectedText.audioUrl} title="Lecture audio du texte" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Lecture guidée"
        subtitle="Améliorez votre compréhension écrite"
        icon={<BookOpen className="h-5 w-5" />}
      />

      {texts.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title="Aucun texte disponible"
          description="De nouveaux textes seront bientôt disponibles."
        />
      ) : (
        <div className="space-y-3">
          {texts.map((text) => (
            <button
              key={text.id}
              onClick={() => { readingStartedAt.current = Date.now(); setSelectedText(text); }}
              className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">{text.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">par {text.author}</p>
                <div className="mt-2 flex items-center gap-3">
                  <LevelBadge level={text.level} />
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {text.estimatedReadingTime} min
                  </span>
                  <span className="text-xs text-muted-foreground">· {text.wordCount} mots</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
