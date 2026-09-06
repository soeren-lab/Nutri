import { Lock, MinusCircle } from "lucide-react";
import type { AchievementState } from "@/lib/achievements";
import { cn } from "@/lib/utils";

/** Grid aller Abzeichen: freigeschaltete hervorgehoben, gesperrte ausgegraut. */
export function AchievementGrid({ achievements }: { achievements: AchievementState[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {achievements.map((a) => {
        const Icon = a.definition.icon;
        return (
          <div
            key={a.definition.key}
            className={cn(
              "relative flex flex-col gap-1.5 overflow-hidden rounded-xl border p-3 transition-all",
              a.unlocked
                ? "border-primary/40 bg-gradient-to-br from-primary/10 to-accent/10"
                : a.unavailable
                ? "border-dashed border-border bg-muted/30 opacity-70"
                : "border-border bg-gradient-to-br from-muted/50 via-muted/20 to-muted/40 hover:border-primary/30 hover:from-primary/5 hover:to-accent/5 active:scale-[0.98]",
            )}
          >

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  a.unlocked
                    ? "bg-gradient-to-br from-primary to-accent text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {a.unlocked ? (
                  <Icon className="h-4 w-4" strokeWidth={2.5} />
                ) : a.unavailable ? (
                  <MinusCircle className="h-3.5 w-3.5" />
                ) : (
                  <Lock className="h-3.5 w-3.5" />
                )}
              </span>
              <p
                className={cn(
                  "min-w-0 text-sm font-semibold leading-tight",
                  !a.unlocked && "text-muted-foreground",
                )}
              >
                {a.title}
              </p>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {a.description}
            </p>
            {a.unlocked ? (
              a.unlockedAt ? (
                <p className="text-[10px] font-medium text-primary">
                  Freigeschaltet am{" "}
                  {new Date(a.unlockedAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              ) : (
                <p className="text-[10px] font-medium text-primary">Freigeschaltet</p>
              )
            ) : a.unavailable ? (
              <p className="text-[10px] font-medium text-muted-foreground">
                Nicht verfügbar (Tracking deaktiviert)
              </p>
            ) : a.progressLabel ? (
              <div className="space-y-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                    style={{
                      width: `${Math.min(100, Math.round((a.value / a.definition.goalValue) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {a.progressLabel}
                </p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
