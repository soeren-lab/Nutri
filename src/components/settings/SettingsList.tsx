import { Link, type LinkProps } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Abschnitts-Überschrift über einer Einstellungs-Gruppe. */
export function SettingsSectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

/** Zusammenhängende Card mit Trennlinien zwischen den Zeilen. */
export function SettingsGroup({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section>
      {title && <SettingsSectionHeader>{title}</SettingsSectionHeader>}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        {children}
      </div>
    </section>
  );
}

type RowVisual = {
  icon: LucideIcon;
  title: string;
  subtitle?: string | null;
  tone?: "default" | "danger";
};

function RowInner({ icon: Icon, title, subtitle, tone }: RowVisual) {
  const danger = tone === "danger";
  return (
    <>
      <Icon
        className={cn("h-4 w-4 shrink-0", danger ? "text-destructive" : "text-primary")}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            danger && "text-destructive",
          )}
        >
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </>
  );
}

const ROW_CLASS =
  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60";

/** Einstellungs-Zeile, die auf eine Unterseite führt. */
export function SettingsRow({
  icon,
  title,
  subtitle,
  tone,
  ...link
}: RowVisual & LinkProps) {
  return (
    <Link {...(link as LinkProps)} className={ROW_CLASS}>
      <RowInner icon={icon} title={title} subtitle={subtitle} tone={tone} />
    </Link>
  );
}

/** Einstellungs-Zeile mit Aktion statt Navigation. */
export function SettingsActionRow({
  onClick,
  disabled,
  ...visual
}: RowVisual & { onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={ROW_CLASS}>
      <RowInner {...visual} />
    </button>
  );
}
