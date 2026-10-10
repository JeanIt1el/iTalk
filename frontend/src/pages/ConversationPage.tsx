import { useEffect, useState, useRef, useCallback } from 'react';
import { Send, Languages, Sparkles, X, RotateCcw, Flag, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { AIMessageBubble } from '@/components/conversation/AIMessageBubble';
import { LearnerMessageBubble } from '@/components/conversation/LearnerMessageBubble';
import { CorrectionCard } from '@/components/conversation/CorrectionCard';
import { TypingIndicator } from '@/components/conversation/TypingIndicator';
import { ResponseSuggestions } from '@/components/conversation/ResponseSuggestions';
import { SessionSummary } from '@/components/conversation/SessionSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EmptyState } from '@/components/shared/EmptyState';
import { conversationService } from '@/services/conversation.service';
import type {
  ConversationMessage,
  ConversationCorrection,
  ConversationSummary,
  ConversationScenarioInfo,
  ConversationScenario,
} from '@/types/conversation';
import { useLearningStore } from '@/stores/useLearningStore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function ConversationPage() {
  const { showTranslations, setShowTranslations } = useLearningStore();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<ConversationScenarioInfo[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ConversationScenarioInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [corrections, setCorrections] = useState<ConversationCorrection[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [enableCorrections, setEnableCorrections] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    conversationService.getScenarios().then(setScenarios);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const startSession = useCallback(async (scenario: ConversationScenarioInfo) => {
    setSummary(null);
    setShowSummary(false);
    setCorrections([]);
    setSuggestions([]);
    try {
      const session = await conversationService.startSession(scenario.id);
      setSelectedScenario(scenario);
      setSessionId(session.id);
      setMessages(session.messages);
    } catch {
      toast('Impossible de démarrer la conversation. Vérifiez votre connexion puis réessayez.', { variant: 'error' });
    }
  }, [toast]);

  const handleSend = useCallback(async (text?: string) => {
    const content = text ?? input.trim();
    if (!content || isTyping || !sessionId) return;

    const userMsg: ConversationMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      translation: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setCorrections([]);
    setSuggestions([]);

    abortRef.current = new AbortController();

    try {
      const reply = await conversationService.sendMessage(
        sessionId,
        content,
        showTranslations,
        enableCorrections,
        abortRef.current.signal,
        () => setIsTyping(true),
        (msg) => {
          setMessages((prev) => [...prev, msg]);
          setIsTyping(false);
        },
        (cors) => setCorrections(cors),
        (sugs) => setSuggestions(sugs),
      );

      // Apply corrections to user message
      if (enableCorrections && reply.corrections) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMsg.id ? { ...m, corrections: reply.corrections } : m,
          ),
        );
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        toast('Erreur lors de l\'envoi du message', { variant: 'error' });
        setIsTyping(false);
      }
    }
  }, [input, isTyping, showTranslations, enableCorrections, toast, sessionId]);

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    const sum = await conversationService.endSession(sessionId);
    setSummary(sum);
    setShowSummary(true);
    toast('Session terminée !', { variant: 'success' });
  }, [toast, sessionId]);

  const handleRestart = useCallback(() => {
    setSelectedScenario(null);
    setSessionId(null);
    setMessages([]);
    setSummary(null);
    setShowSummary(false);
    setCorrections([]);
    setSuggestions([]);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Conversation IA"
        subtitle="Pratiquez votre anglais avec un partenaire IA"
      />

      {!selectedScenario ? (
        /* Scenario selection */
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Choisissez un scénario</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => startSession(scenario)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{scenario.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{scenario.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[0.65rem] font-semibold text-primary">{scenario.level}</span>
                    <span className="text-[0.65rem] text-muted-foreground">· {scenario.estimatedDuration} min</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </button>
            ))}
          </div>
        </div>
      ) : showSummary && summary ? (
        /* Session summary */
        <SessionSummary summary={summary} onRestart={handleRestart} onClose={() => setShowSummary(false)} />
      ) : (
        /* Active conversation */
        <>
          {/* Session header */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedScenario.title}</p>
                <p className="text-[0.7rem] text-muted-foreground">{messages.length} messages</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Switch
                  id="translations"
                  checked={showTranslations}
                  onCheckedChange={setShowTranslations}
                />
                <Label htmlFor="translations" className="text-xs text-muted-foreground cursor-pointer">
                  <Languages className="h-3.5 w-3.5" />
                </Label>
              </div>
              <Button variant="ghost" size="sm" onClick={handleEndSession}>
                <Flag className="mr-1 h-3.5 w-3.5" />
                Terminer
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="h-[calc(100vh-20rem)] min-h-[300px] rounded-xl border border-border bg-card p-4">
            <div className="space-y-4">
              {messages.map((msg) =>
                msg.role === 'assistant' ? (
                  <AIMessageBubble key={msg.id} message={msg} showTranslation={showTranslations} />
                ) : (
                  <LearnerMessageBubble key={msg.id} message={msg} />
                ),
              )}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Corrections */}
          {corrections.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                Corrections ({corrections.length})
              </p>
              {corrections.map((c) => (
                <CorrectionCard key={c.id} correction={c} />
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && !isTyping && (
            <ResponseSuggestions
              suggestions={suggestions}
              onSelect={(s) => handleSend(s)}
            />
          )}

          {/* Input */}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Écrivez votre message en anglais…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isTyping}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              aria-label="Envoyer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Switch
                id="corrections"
                checked={enableCorrections}
                onCheckedChange={setEnableCorrections}
              />
              <Label htmlFor="corrections" className="text-xs text-muted-foreground cursor-pointer">
                Corrections automatiques
              </Label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
