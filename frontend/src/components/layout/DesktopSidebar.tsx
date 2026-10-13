import { NavLink } from 'react-router-dom';
import {
  Home,
  GraduationCap,
  MessageCircle,
  TrendingUp,
  User,
  PenLine,
  Layers,
  Mic,
  Settings,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';

const navItems = [
  { path: '/home', label: 'Accueil', icon: Home },
  { path: '/modules', label: 'Apprendre', icon: GraduationCap },
  { path: '/conversation', label: 'Discuter', icon: MessageCircle },
  { path: '/grammar', label: 'Grammaire', icon: PenLine },
  { path: '/vocabulary', label: 'Vocabulaire', icon: Layers },
  { path: '/speaking', label: 'Expression orale', icon: Mic },
  { path: '/progress', label: 'Progrès', icon: TrendingUp },
  { path: '/profile', label: 'Profil', icon: User },
  { path: '/settings', label: 'Paramètres', icon: Settings },
];

export function DesktopSidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="flex items-center gap-2.5 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          <p className="text-[0.7rem] text-muted-foreground">Apprentissage IA</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation latérale">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[0.7rem] text-muted-foreground">
          v1.0.0 — Phase bêta
        </p>
      </div>
    </aside>
  );
}
