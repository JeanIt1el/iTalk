import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) {
        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 3600000);
      }
    },
  });

  useEffect(() => {
    setShowPrompt(needRefresh || offlineReady);
  }, [needRefresh, offlineReady]);

  if (!showPrompt) return null;

  const close = () => {
    setShowPrompt(false);
    setNeedRefresh(false);
    setOfflineReady(false);
  };

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm animate-fade-in-up rounded-2xl border border-border bg-card p-4 shadow-xl lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-xs">
      <button
        onClick={close}
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Fermer"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-semibold text-foreground">
            {needRefresh ? 'Mise à jour disponible' : 'Prêt hors ligne'}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {needRefresh
              ? 'Une nouvelle version d\'iTalk est disponible. Mettez à jour pour profiter des dernières améliorations.'
              : 'L\'application peut désormais fonctionner hors ligne.'}
          </p>
          {needRefresh ? (
            <Button
              size="sm"
              onClick={() => updateServiceWorker(true)}
              className="mt-3 w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Mettre à jour
            </Button>
          ) : (
            <Button size="sm" onClick={close} className="mt-3 w-full">
              D'accord
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
