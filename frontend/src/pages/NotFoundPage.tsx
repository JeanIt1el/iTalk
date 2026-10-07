import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Compass className="h-10 w-10" />
      </div>
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">404</h1>
        <p className="mt-2 text-lg font-semibold text-foreground">Page introuvable</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
      </div>
      <Button asChild>
        <Link to="/home">
          <Home className="mr-2 h-4 w-4" />
          Retour à l'accueil
        </Link>
      </Button>
    </div>
  );
}
