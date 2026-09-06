import { getColorForProgress } from "@/lib/nutritionScore";
import { cn } from "@/lib/utils";

/**
 * Ring-Fortschritt für geplante kcal vs. Ziel.
 * Farbe folgt dem Rot→Grün-Prinzip: nahe am Ziel = grün.
 */
export function DailyProgressRing({
  value,
  target,
  size = 44,
  className,
}: {
  value: number;
  target: number;
  size?: number;
  className?: string;
}) {
  const stroke = Math.max(3, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? Math.max(0, Math.min(1, value / target)) : 0;
  const color = getColorForProgress(value, target);
  const percent = target > 0 ? Math.round((value / target) * 100) : 0;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      title={`${Math.round(value)} von ${Math.round(target)} kcal`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
        style={{ color }}
      >
        {percent}%
      </span>
    </span>
  );
}
