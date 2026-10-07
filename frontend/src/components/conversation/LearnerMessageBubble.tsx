import type { ConversationMessage } from '@/types/conversation';
import { cn } from '@/lib/utils';

interface LearnerMessageBubbleProps {
  message: ConversationMessage;
}

export function LearnerMessageBubble({ message }: LearnerMessageBubbleProps) {
  return (
    <div className="flex justify-end animate-fade-in-up">
      <div className="max-w-[80%]">
        <div className="rounded-2xl rounded-tr-md bg-primary px-4 py-2.5">
          <p className="text-sm leading-relaxed text-primary-foreground">{message.content}</p>
        </div>
        {message.corrections && message.corrections.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[0.7rem] text-amber-600 dark:text-amber-400">
              {message.corrections.length} correction{message.corrections.length > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
