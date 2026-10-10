import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';

type AuthMode = 'login' | 'register';

function getAuthErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : '';
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'Un compte existe déjà avec cette adresse e-mail. Essayez de vous connecter.';
  }
  if (message.includes('password') && (message.includes('short') || message.includes('least'))) {
    return 'Le mot de passe ne respecte pas les exigences minimales de Supabase.';
  }
  if (message.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (message.includes('email') && message.includes('invalid')) {
    return 'Veuillez saisir une adresse e-mail valide.';
  }
  return cause instanceof Error ? cause.message : 'Une erreur est survenue. Réessayez.';
}

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(import.meta.env.VITE_DEV_AUTH_EMAIL ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'register' && fullName.trim().length < 2) {
      setError('Le nom complet doit contenir au moins 2 caractères.');
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        const result = await authService.register(fullName.trim(), email.trim(), password);
        if (!result.isAuthenticated) {
          setNotice('Compte créé. Consultez votre boîte e-mail pour confirmer votre adresse, puis connectez-vous.');
        }
      } else {
        await authService.login(email.trim(), password);
      }
    } catch (cause) {
      setError(getAuthErrorMessage(cause));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{mode === 'register' ? 'Créer un compte' : 'Connexion à iTalk'}</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'register'
              ? 'Créez votre compte pour commencer à apprendre.'
              : 'Connectez-vous avec votre compte Supabase.'}
          </p>
        </header>
        <div className="grid grid-cols-2 rounded-md bg-muted p-1" role="tablist" aria-label="Authentification">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`rounded px-3 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setMode('login'); setError(null); setNotice(null); }}
          >
            Se connecter
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`rounded px-3 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => { setMode('register'); setError(null); setNotice(null); }}
          >
            Inscription
          </button>
        </div>
        {mode === 'register' && (
          <div className="space-y-2">
            <Label htmlFor="auth-full-name">Nom complet</Label>
            <Input
              id="auth-full-name"
              type="text"
              autoComplete="name"
              minLength={2}
              maxLength={120}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="auth-email">Adresse e-mail</Label>
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="auth-password">Mot de passe</Label>
          <Input
            id="auth-password"
            type="password"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 8 : undefined}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? (mode === 'register' ? 'Création du compte…' : 'Connexion…')
            : (mode === 'register' ? 'Créer mon compte' : 'Se connecter')}
        </Button>
      </form>
    </main>
  );
}
