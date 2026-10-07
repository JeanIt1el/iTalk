import { create } from 'zustand';
import type { ThemePreference } from '@/types/user';

interface ThemeStore {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem('italk-theme') as ThemePreference | null;
  return stored ?? 'system';
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', isDark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isDark ? '#1a1a2e' : '#3730a3');
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem('italk-theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const current = get().theme;
    const next: ThemePreference = current === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

// Apply theme on module load
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme());
  // Listen for system theme changes when in system mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().theme === 'system') {
      applyTheme('system');
    }
  });
}
