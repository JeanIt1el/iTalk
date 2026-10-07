import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, SlidersHorizontal, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ModuleCard } from '@/components/shared/ModuleCard';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TopicChip } from '@/components/shared/TopicChip';
import { LevelBadge } from '@/components/shared/LevelBadge';
import { learningService } from '@/services/learning.service';
import { CEFR_LEVELS, SKILL_LABELS } from '@/lib/constants';
import type { LearningModule } from '@/types/learning';
import type { CEFRLevel, SkillType } from '@/types/user';
import { cn } from '@/lib/utils';

export function ModulesPage() {
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('id');
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<CEFRLevel | null>(null);
  const [skillFilter, setSkillFilter] = useState<SkillType | null>(null);
  const [maxDuration, setMaxDuration] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    learningService.getModules().then((result) => {
      setModules(result.modules);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      if (levelFilter && m.level !== levelFilter) return false;
      if (skillFilter && m.skill !== skillFilter) return false;
      if (maxDuration && m.durationMinutes > maxDuration) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.title.toLowerCase().includes(s) && !m.description.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [modules, levelFilter, skillFilter, maxDuration, search]);

  const activeFilterCount = (levelFilter ? 1 : 0) + (skillFilter ? 1 : 0) + (maxDuration ? 1 : 0);

  const clearFilters = () => {
    setLevelFilter(null);
    setSkillFilter(null);
    setMaxDuration(null);
  };

  if (loading) return <LoadingState message="Chargement des modules…" />;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Catalogue de modules"
        subtitle="Explorez tous nos parcours d'apprentissage"
      />

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un module…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Filtres
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[0.65rem]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" />
            Effacer
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 animate-fade-in">
          {/* Level filter */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Niveau</p>
            <div className="flex flex-wrap gap-2">
              {CEFR_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setLevelFilter(levelFilter === level.value ? null : level.value)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                    levelFilter === level.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  {level.value}
                </button>
              ))}
            </div>
          </div>

          {/* Skill filter */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Compétence</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SKILL_LABELS) as SkillType[]).map((skill) => (
                <button
                  key={skill}
                  onClick={() => setSkillFilter(skillFilter === skill ? null : skill)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                    skillFilter === skill
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  {SKILL_LABELS[skill]}
                </button>
              ))}
            </div>
          </div>

          {/* Duration filter */}
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Durée maximale</p>
            <div className="flex flex-wrap gap-2">
              {[10, 15, 20, 30].map((dur) => (
                <button
                  key={dur}
                  onClick={() => setMaxDuration(maxDuration === dur ? null : dur)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                    maxDuration === dur
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card hover:border-primary/30',
                  )}
                >
                  ≤ {dur} min
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Filter className="h-7 w-7" />}
          title="Aucun module trouvé"
          description="Essayez de modifier vos filtres ou votre recherche."
          action={
            <Button variant="outline" size="sm" onClick={() => { clearFilters(); setSearch(''); }}>
              Réinitialiser
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} module{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((mod) => (
              <ModuleCard key={mod.id} module={mod} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
