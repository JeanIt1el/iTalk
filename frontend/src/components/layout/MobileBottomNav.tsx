import { NavLink } from 'react-router-dom';
import { Home, GraduationCap, MessageCircle, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { path: '/home', label: 'Accueil', icon: Home },
  { path: '/modules', label: 'Apprendre', icon: GraduationCap },
  { path: '/conversation', label: 'Discuter', icon: MessageCircle },
  { path: '/progress', label: 'Progrès', icon: TrendingUp },
  { path: '/profile', label: 'Profil', icon: User },
];

export function MobileBottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-bottom"
      aria-label="Navigation principale"
    >
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
              aria-label={item.label}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-5 w-5 transition-transform',
                      isActive && 'scale-110',
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="text-[0.65rem] font-medium leading-none">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
