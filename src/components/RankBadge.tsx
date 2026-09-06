import { RANK_ICONS, RANK_IMAGES, type RankTier } from "@/lib/ranks";
import { cn } from "@/lib/utils";

/**
 * Rang-Abzeichen: eigenes Bild-Icon pro Stufe, sonst farbiges Badge mit Sternen.
 */
export function RankBadge({
  tier,
  size = 64,
  showLabel = false,
  className,
}: {
  tier: RankTier;
  size?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const cfg = RANK_ICONS[tier.group];
  const Icon = cfg.icon;
  const image = RANK_IMAGES[tier.key];

  if (image) {
    return (
      <div className={cn("flex flex-col items-center gap-1.5", className)}>
        <img
          src={image}
          alt={`Rang ${tier.label}`}
          width={size}
          height={size}
          className="shrink-0 object-contain"
          style={{
            width: size,
            height: size,
            filter: cfg.glow ? `drop-shadow(0 0 10px ${cfg.from}aa)` : undefined,
          }}
        />
        {showLabel && <span className="text-xs font-semibold">{tier.label}</span>}
      </div>
    );
  }


  return (
    <div className={cn("flex flex-col items-center gap-1.5", className)}>
      <span
        className="relative grid shrink-0 place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, ${cfg.from}, ${cfg.to})`,
          boxShadow: cfg.glow
            ? `0 0 0 2px ${cfg.ring}55, 0 0 18px ${cfg.from}88`
            : `0 0 0 2px ${cfg.ring}55`,
        }}
        aria-hidden
      >
        <Icon
          strokeWidth={2.2}
          style={{ width: size * 0.44, height: size * 0.44, color: "#ffffff" }}
        />
        <span
          className="absolute -bottom-1 flex items-center gap-0.5 rounded-full px-1.5 py-0.5"
          style={{ background: cfg.to, boxShadow: `0 0 0 1.5px ${cfg.ring}66` }}
        >
          {Array.from({ length: tier.level }).map((_, i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{
                width: Math.max(3, size * 0.07),
                height: Math.max(3, size * 0.07),
                background: cfg.ring,
              }}
            />
          ))}
        </span>
      </span>
      {showLabel && <span className="text-xs font-semibold">{tier.label}</span>}
      <span className="sr-only">Rang {tier.label}</span>
    </div>
  );
}
