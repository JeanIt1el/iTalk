import { useState, useEffect } from 'react';
import { Download, X, Sparkles } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const { canInstall, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('italk-install-dismissed');
    if (stored) setDismissed(true);
  }, []);

  if (!canInstall || dismissed) return null;

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('italk-install-dismissed', 'true');
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-sm animate-fade-in-up rounded-2xl border border-border bg-card p-4 shadow-xl lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-xs">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-semibold text-foreground">Installer iTalk</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accédez à votre apprentissage hors ligne, directement depuis votre écran d'accueil.
          </p>
          <Button size="sm" onClick={handleInstall} className="mt-3 w-full">
            <Download className="mr-2 h-4 w-4" />
            Installer l'application
          </Button>
        </div>
      </div>
    </div>
  );
}
