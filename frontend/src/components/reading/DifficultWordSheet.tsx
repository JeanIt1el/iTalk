import { BookOpen } from 'lucide-react';
import type { DifficultWord } from '@/types/learning';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface DifficultWordSheetProps {
  words: DifficultWord[];
}

export function DifficultWordSheet({ words }: DifficultWordSheetProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-2 h-4 w-4" />
          Vocabulaire ({words.length})
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Mots difficiles du texte</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {words.map((word, idx) => (
            <div key={idx} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-foreground">{word.word}</h4>
                <span className="text-xs text-muted-foreground">{word.phonetic}</span>
              </div>
              <p className="mt-1 text-sm font-medium text-primary">{word.translation}</p>
              <p className="mt-1 text-xs text-muted-foreground">{word.definition}</p>
              <p className="mt-1.5 text-xs italic text-muted-foreground">« {word.example} »</p>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
