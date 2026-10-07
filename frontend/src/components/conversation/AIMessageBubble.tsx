import { Sparkles, Languages } from 'lucide-react';
import type { ConversationMessage } from '@/types/conversation';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AIMessageBubbleProps {
  message: ConversationMessage;
  showTranslation: boolean;
}

export function AIMessageBubble({ message, showTranslation }: AIMessageBubbleProps) {
  const [translationVisible, setTranslationVisible] = useState(showTranslation);

  return (
    <div className="flex items-start gap-2.5 animate-fade-in-up">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex max-w-[80%] flex-col gap-1">
        <div className="rounded-2xl rounded-tl-md bg-card border border-border px-4 py-2.5">
          <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
          {translationVisible && message.translation && (
            <div className="mt-2 border-t border-border/50 pt-2">
              <p className="text-xs italic text-muted-foreground">{message.translation}</p>
            </div>
          )}
        </div>
        {message.translation && (
          <button
            onClick={() => setTranslationVisible((v) => !v)}
            className="flex items-center gap-1 self-start text-[0.7rem] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Languages className="h-3 w-3" />
            {translationVisible ? 'Masquer la traduction' : 'Traduire'}
          </button>
        )}
      </div>
    </div>
  );
}
