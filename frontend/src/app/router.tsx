import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { HomePage } from '@/pages/HomePage';
import { ModulesPage } from '@/pages/ModulesPage';
import { ConversationPage } from '@/pages/ConversationPage';
import { GrammarPage } from '@/pages/GrammarPage';
import { VocabularyPage } from '@/pages/VocabularyPage';
import { SpeakingPage } from '@/pages/SpeakingPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/onboarding',
    element: <OnboardingPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'modules', element: <ModulesPage /> },
      { path: 'conversation', element: <ConversationPage /> },
      { path: 'grammar', element: <GrammarPage /> },
      { path: 'vocabulary', element: <VocabularyPage /> },
      { path: 'speaking', element: <SpeakingPage /> },
      { path: 'progress', element: <ProgressPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
