import { useEffect, useState } from 'react';
import { Layers, ChevronLeft, RotateCw, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { VocabularyFlashcard } from '@/components/vocabulary/VocabularyFlashcard';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { learningService } from '@/services/learning.service';
import { useToast } from '@/hooks/use-toast';
import type { VocabularyItem, VocabularyCollection, SrsRating } from '@/types/learning';
import { cn } from '@/lib/utils';

const collectionColors: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export function VocabularyPage() {
  const { toast } = useToast();
  const [collections, setCollections] = useState<VocabularyCollection[]>([]);
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<VocabularyCollection | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);

  useEffect(() => {
    Promise.all([
      learningService.getVocabularyCollections(),
      learningService.getVocabularyItems(),
    ]).then(([cols, items]) => {
      setCollections(cols);
      setItems(items);
      setLoading(false);
    });
  }, []);

  const handleRate = async (rating: SrsRating) => {
    const currentItem = currentItems[currentIndex];
    if (!currentItem) return;

    try {
      await learningService.reviewVocabularyItem(currentItem.id, rating);
      setReviewedCount((c) => c + 1);
      toast(`Mot noté : ${rating === 'again' ? 'À revoir' : rating === 'hard' ? 'Difficile' : rating === 'good' ? 'Correct' : 'Facile'}`, {
        variant: rating === 'again' || rating === 'hard' ? 'warning' : 'success',
      });

      if (currentIndex < currentItems.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        toast('Révision terminée !', { variant: 'success' });
        setCurrentIndex(0);
      }
    } catch {
      toast('Erreur lors de la révision', { variant: 'error' });
    }
  };

  const currentItems = selectedCollection
    ? items.filter((i) => i.collection === selectedCollection.id)
    : items;

  if (loading) return <LoadingState message="Chargement du vocabulaire…" />;

  if (selectedCollection) {
    const currentItem = currentItems[currentIndex];
    const progress = ((currentIndex + 1) / currentItems.length) * 100;

    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedCollection(null); setCurrentIndex(0); setReviewedCount(0); }}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Collections
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {currentIndex + 1} / {currentItems.length}
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-sm font-semibold">{selectedCollection.name}</h2>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {currentItem ? (
          <VocabularyFlashcard item={currentItem} onRate={handleRate} />
        ) : (
          <EmptyState
            icon={<Layers className="h-7 w-7" />}
            title="Aucun mot dans cette collection"
            description="Cette collection est vide pour le moment."
          />
        )}

        {reviewedCount > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-success" />
            {reviewedCount} mot{reviewedCount > 1 ? 's' : ''} révisé{reviewedCount > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Vocabulaire"
        subtitle="Apprenez avec des flashcards et répétition espacée"
        icon={<Layers className="h-5 w-5" />}
      />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Collections</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {collections.map((col) => {
            const colItems = items.filter((i) => i.collection === col.id);
            const reviewed = colItems.filter((i) => i.srsLevel >= 3).length;
            return (
              <button
                key={col.id}
                onClick={() => { setSelectedCollection(col); setCurrentIndex(0); setReviewedCount(0); }}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', collectionColors[col.color] ?? collectionColors.primary)}>
                  <Layers className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{col.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{col.description}</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{col.wordCount} mots</span>
                    <span className="text-xs text-primary">{col.level}</span>
                    {reviewed > 0 && (
                      <span className="text-xs text-success">{reviewed} maîtrisés</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
