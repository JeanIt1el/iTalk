import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  showBack?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
  showBack = false,
  className,
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex items-start gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
