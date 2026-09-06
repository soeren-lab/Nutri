import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Download,
  FlaskConical,
  FileText,
  Image,
  Lock,
  LogOut,
  Mail,
  Palette,
  Scale,
  ScrollText,
  Trash2,
  Utensils,
  Wrench,
  Zap,
} from "lucide-react";
import { SettingsActionRow, SettingsGroup, SettingsRow } from "@/components/settings/SettingsList";
import { UsernameDisplay } from "@/components/UsernameDisplay";
import { CURRENT_PLAN, PLAN_LABELS } from "@/lib/plans";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useQuickEntryTemplates } from "@/hooks/use-quick-entry-templates";
import { useTheme } from "@/hooks/use-theme";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { THEME_LABELS } from "@/lib/theme";
import { recipesQuery } from "@/lib/recipes";
import { findSideDishCandidates } from "@/lib/sideDishMigration";
import { supabase } from "@/integrations/supabase/client";

/** Verwaltung als Einstellungs-Liste mit Unterseiten. */
export function SettingsListTab() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { avatarUrl } = useUserAvatar();
  const { isAdmin } = useIsAdmin();
  const { templates } = useQuickEntryTemplates();
  const { data: recipes = [] } = useQuery(recipesQuery());
  const sideDishCount = useMemo(() => findSideDishCandidates(recipes).length, [recipes]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <UsernameDisplay />
        {CURRENT_PLAN === "free" && (
          <Link
            to="/profile/settings/plan"
            className="inline-flex h-11 items-center justify-center self-start rounded-xl bg-gradient-to-br from-primary via-primary to-indigo-600 px-5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          >
            Upgrade auf Pro
          </Link>
        )}
      </div>

      <SettingsGroup title="Profil">
        <SettingsRow
          to="/profile/settings/avatar"
          icon={Image}
          title="Profilbild"
          subtitle={avatarUrl ? "Gesetzt" : "Nicht gesetzt"}
        />
        <SettingsRow
          to="/profile/settings/appearance"
          icon={Palette}
          title="Darstellung"
          subtitle={THEME_LABELS[theme]}
        />
      </SettingsGroup>

      <SettingsGroup title="Account & Sicherheit">
        <SettingsRow
          to="/profile/settings/email"
          icon={Mail}
          title="E-Mail"
          subtitle={user?.email ?? "Nicht angemeldet"}
        />
        <SettingsRow to="/profile/settings/password" icon={Lock} title="Passwort" />
        <SettingsRow
          to="/profile/settings/delete"
          icon={Trash2}
          title="Account löschen"
          tone="danger"
        />
      </SettingsGroup>

      <SettingsGroup title="Planer & Rezepte">
        <SettingsRow
          to="/profile/settings/quick-entries"
          icon={Zap}
          title="Meine Schnelleinträge"
          subtitle={templates.length === 1 ? "1 Vorlage" : `${templates.length} Vorlagen`}
        />
        {sideDishCount > 0 && (
          <SettingsRow
            to="/profile/settings/side-dishes"
            icon={Utensils}
            title="Beilagen entkoppeln"
            subtitle={sideDishCount === 1 ? "1 Rezept" : `${sideDishCount} Rezepte`}
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="Abo & Zahlung">
        <SettingsRow
          to="/profile/settings/plan"
          icon={CreditCard}
          title="Mein Plan"
          subtitle={PLAN_LABELS[CURRENT_PLAN]}
        />
      </SettingsGroup>

      <SettingsGroup title="Rechtliches">
        <SettingsRow to="/legal/datenschutz" icon={FileText} title="Datenschutzerklärung" />
        <SettingsRow to="/legal/agb" icon={ScrollText} title="Nutzungsbedingungen (AGB)" />
        <SettingsRow to="/legal/impressum" icon={Scale} title="Impressum" />
      </SettingsGroup>

      <SettingsGroup title="Daten">
        <SettingsRow to="/profile/settings/export" icon={Download} title="Daten exportieren" />
      </SettingsGroup>

      <SettingsGroup>
        <SignOutRow />
      </SettingsGroup>

      {isAdmin && (
        <SettingsGroup title="Entwickler">
          <SettingsRow
            to="/profile/settings/patch-notes"
            icon={Wrench}
            title="Patch Notes verwalten"
          />
          <SettingsRow
            to="/profile/settings/experimental"
            icon={FlaskConical}
            title="Experimental"
            subtitle="Neue Glass-Oberfläche"
          />
        </SettingsGroup>
      )}
    </div>
  );
}

function SignOutRow() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      void navigate({ to: "/auth", replace: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsActionRow
      icon={LogOut}
      title="Abmelden"
      tone="danger"
      disabled={busy}
      onClick={() => void signOut()}
    />
  );
}
