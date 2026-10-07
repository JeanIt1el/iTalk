import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { MobileBottomNav } from './MobileBottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { TopHeader } from './TopHeader';

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />
      <div className="lg:pl-64">
        <TopHeader />
        <main className="min-h-[calc(100vh-3.5rem)] px-4 py-5 pb-nav lg:px-8 lg:py-6">
          {children ?? <Outlet />}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
