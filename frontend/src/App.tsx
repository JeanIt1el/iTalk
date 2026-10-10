import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpdatePrompt } from '@/components/pwa/UpdatePrompt';
import { LoadingState } from '@/components/shared/LoadingState';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { router } from '@/app/router';
import { supabase } from '@/lib/supabase';
import { authService, mapSupabaseUser } from '@/services/auth.service';
import { useAuthStore } from '@/stores/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const authInitialized = useAuthStore((state) => state.authInitialized);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    let mounted = true;
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      useAuthStore.getState().setSession(
        session?.user ? mapSupabaseUser(session.user) : null,
        session?.access_token ?? null,
      );
    }).data.subscription;

    void authService.initialize().finally(() => {
      if (mounted) useAuthStore.getState().setAuthInitialized(true);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (!authInitialized) {
    return <LoadingState message="Initialisation de votre session…" />;
  }

  if (!isAuthenticated) return <AuthScreen />;

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <InstallPrompt />
      <UpdatePrompt />
    </QueryClientProvider>
  );
}

export default App;
