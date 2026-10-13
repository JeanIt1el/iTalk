import { useState } from 'react';
import { Settings, Moon, Sun, Monitor, Bell, Lock, Eye, Globe, Trash2, Download, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { useThemeStore } from '@/stores/useThemeStore';
import { useLearningStore } from '@/stores/useLearningStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToast } from '@/hooks/use-toast';
import type { ThemePreference } from '@/types/user';
import { cn } from '@/lib/utils';

export function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { showTranslations, setShowTranslations, dailyGoalMinutes, setDailyGoalMinutes } = useLearningStore();
  const { user, logout } = useAuthStore();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const [notifications, setNotifications] = useState({
    dailyReminder: user?.preferences.notifications.dailyReminder ?? true,
    streakAlerts: user?.preferences.notifications.streakAlerts ?? true,
    achievementAlerts: user?.preferences.notifications.achievementAlerts ?? true,
  });

  const [privacy, setPrivacy] = useState({
    shareProgress: user?.preferences.privacy.shareProgress ?? true,
    publicProfile: user?.preferences.privacy.publicProfile ?? false,
  });

  const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Paramètres"
        subtitle="Personnalisez votre expérience"
        icon={<Settings className="h-5 w-5" />}
      />

      {/* Appearance */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Apparence</h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          {/* Theme */}
          <div>
            <Label className="text-sm font-medium">Thème</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      theme === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30',
                    )}
                  >
                    <Icon className="h-5 w-5 text-foreground" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </section>

      {/* Learning preferences */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Préférences d'apprentissage</h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="translations" className="text-sm font-medium cursor-pointer">Afficher les traductions</Label>
            </div>
            <Switch id="translations" checked={showTranslations} onCheckedChange={setShowTranslations} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Objectif quotidien</Label>
              </div>
              <span className="text-sm font-bold text-primary">{dailyGoalMinutes} min</span>
            </div>
            <Slider
              value={[dailyGoalMinutes]}
              onValueChange={(v) => setDailyGoalMinutes(v[0])}
              min={5}
              max={60}
              step={5}
            />
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Notifications</h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="daily-reminder" className="text-sm font-medium cursor-pointer">Rappel quotidien</Label>
            </div>
            <Switch
              id="daily-reminder"
              checked={notifications.dailyReminder}
              onCheckedChange={(v) => setNotifications((n) => ({ ...n, dailyReminder: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="streak-alerts" className="text-sm font-medium cursor-pointer">Alertes de série</Label>
            </div>
            <Switch
              id="streak-alerts"
              checked={notifications.streakAlerts}
              onCheckedChange={(v) => setNotifications((n) => ({ ...n, streakAlerts: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="achievement-alerts" className="text-sm font-medium cursor-pointer">Alertes de réussite</Label>
            </div>
            <Switch
              id="achievement-alerts"
              checked={notifications.achievementAlerts}
              onCheckedChange={(v) => setNotifications((n) => ({ ...n, achievementAlerts: v }))}
            />
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Confidentialité</h2>
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="share-progress" className="text-sm font-medium cursor-pointer">Partager mes progrès</Label>
            </div>
            <Switch
              id="share-progress"
              checked={privacy.shareProgress}
              onCheckedChange={(v) => setPrivacy((p) => ({ ...p, shareProgress: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="public-profile" className="text-sm font-medium cursor-pointer">Profil public</Label>
            </div>
            <Switch
              id="public-profile"
              checked={privacy.publicProfile}
              onCheckedChange={(v) => setPrivacy((p) => ({ ...p, publicProfile: v }))}
            />
          </div>
        </div>
      </section>

      {/* Data & account */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Données et compte</h2>
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => toast('Export des données en préparation', { variant: 'default' })}>
            <Download className="mr-2 h-4 w-4" />
            Exporter mes données
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => setShowLogoutDialog(true)}>
            <LogOut className="mr-2 h-4 w-4" />
            Se déconnecter
          </Button>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer mon compte
          </Button>
        </div>
      </section>

      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Supprimer le compte"
        description="Cette action est irréversible. Toutes vos données seront définitivement supprimées."
        confirmLabel="Supprimer définitivement"
        variant="destructive"
        onConfirm={() => {
          setShowDeleteDialog(false);
          toast('Compte supprimé (simulation)', { variant: 'default' });
        }}
      />

      <ConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        title="Se déconnecter"
        description="Voulez-vous vraiment vous déconnecter ?"
        confirmLabel="Se déconnecter"
        onConfirm={() => {
          logout();
          setShowLogoutDialog(false);
          toast('Vous êtes déconnecté', { variant: 'default' });
        }}
      />
    </div>
  );
}
