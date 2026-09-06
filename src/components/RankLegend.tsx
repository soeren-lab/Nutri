import { useEffect, useRef } from "react";
import { RankBadge } from "@/components/RankBadge";
import {
  RANK_GROUP_LABELS,
  RANK_ICONS,
  RANK_THRESHOLDS,
  type RankGroup,
  type RankTier,
} from "@/lib/ranks";
import { cn } from "@/lib/utils";

type Section = { group: RankGroup; tiers: RankTier[] };

function buildSections(): Section[] {
  const sections: Section[] = [];
  for (const tier of RANK_THRESHOLDS) {
    const last = sections[sections.length - 1];
    if (last && last.group === tier.group) last.tiers.push(tier);
    else sections.push({ group: tier.group, tiers: [tier] });
  }
  return sections;
}

/**
 * Vollständige Rang-Legende, gruppiert nach Rang-Familie:
 * Sektions-Header mit Farbakzent, darunter ein 3er-Grid der Sub-Stufen.
 * Erreichte Ränge farbig, kommende in Graustufen, der aktuelle hervorgehoben.
 */
export function RankLegend({
  currentKey,
  totalPoints,
  className,
}: {
  currentKey: string;
  totalPoints: number;
  className?: string;
}) {
  const sections = buildSections();
  const currentTier = RANK_THRESHOLDS.find((t) => t.key === currentKey);
  const sectionRefs = useRef<Partial<Record<RankGroup, HTMLDivElement | null>>>({});

  // Beim Öffnen direkt zur eigenen Rang-Familie springen.
  useEffect(() => {
    if (!currentTier) return;
    const el = sectionRefs.current[currentTier.group];
    if (!el) return;
    const id = window.setTimeout(
      () => el.scrollIntoView({ block: "center", behavior: "smooth" }),
      120,
    );
    return () => window.clearTimeout(id);
  }, [currentTier?.group]);

  const jumpTo = (group: RankGroup) => {
    sectionRefs.current[group]?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className={cn("space-y-5", className)}>
      {/* Sprungmarken */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {sections.map(({ group }) => {
          const cfg = RANK_ICONS[group];
          const isCurrent = currentTier?.group === group;
          return (
            <button
              key={group}
              type="button"
              onClick={() => jumpTo(group)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                isCurrent ? "border-transparent text-white" : "border-border",
              )}
              style={
                isCurrent
                  ? { background: `linear-gradient(90deg, ${cfg.from}, ${cfg.to})` }
                  : { color: cfg.to }
              }
            >
              {RANK_GROUP_LABELS[group]}
            </button>
          );
        })}
      </div>

      {sections.map(({ group, tiers }) => {
        const cfg = RANK_ICONS[group];
        return (
          <div
            key={group}
            ref={(el) => {
              sectionRefs.current[group] = el;
            }}
            className="scroll-mt-4 space-y-3"
          >
            <div
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{
                background: `linear-gradient(90deg, ${cfg.from}33, ${cfg.to}14)`,
                boxShadow: `inset 0 0 0 1px ${cfg.to}33`,
              }}
            >
              <h3 className="text-sm font-bold tracking-wide" style={{ color: cfg.to }}>
                {RANK_GROUP_LABELS[group]}
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
                ab {tiers[0]!.points.toLocaleString("de-DE")} P.
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {tiers.map((tier) => {
                const reached = totalPoints >= tier.points;
                const isCurrent = tier.key === currentKey;
                return (
                  <div
                    key={tier.key}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl px-2 pb-2.5 pt-3 text-center transition-all",
                      isCurrent ? "border border-transparent" : "border border-border/60",
                    )}
                    style={
                      isCurrent
                        ? {
                            background: `linear-gradient(160deg, ${cfg.from}40, ${cfg.to}1f)`,
                            boxShadow: `0 0 0 2px ${cfg.to}, 0 8px 28px -8px ${cfg.from}cc`,
                          }
                        : undefined
                    }
                  >
                    <div className="relative grid place-items-center">
                      <span
                        aria-hidden
                        className="pointer-events-none absolute size-16 rounded-full blur-lg"
                        style={{
                          background: `radial-gradient(circle, ${cfg.from}${reached ? "55" : "1f"}, transparent 70%)`,
                        }}
                      />
                      <RankBadge
                        tier={tier}
                        size={68}
                        className={cn(
                          "relative",
                          !reached && "opacity-60 grayscale",
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        !reached && "text-muted-foreground",
                      )}
                    >
                      {tier.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {tier.points.toLocaleString("de-DE")} P.
                    </p>
                    {isCurrent && (
                      <span
                        className="mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{
                          background: `linear-gradient(90deg, ${cfg.from}, ${cfg.to})`,
                        }}
                      >
                        Du bist hier
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
