import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RankCard } from "@/components/RankCard";
import { RankLegend } from "@/components/RankLegend";
import { RankStatisticsSection } from "@/components/RankStatisticsSection";
import { useUserRank } from "@/hooks/use-user-rank";
import { RANK_ICONS } from "@/lib/ranks";

const POINTS_CHART_DAYS = 30;

const pointsChartConfig = {
  points: { label: "Punkte", color: "var(--primary)" },
} satisfies ChartConfig;

/** Season-Rang mit Punkte-Verlauf, Erklärtext und Rang-Legende. */
export function RankPanel() {
  const { rank, series, totalPoints, currentStreakDays, streakMultiplier, isLoading } =
    useUserRank();
  const rankCfg = RANK_ICONS[rank.current.group];

  const data = useMemo(() => {
    const recent = series.slice(-POINTS_CHART_DAYS);
    let cumulative = series
      .slice(0, Math.max(0, series.length - POINTS_CHART_DAYS))
      .reduce((s, d) => s + d.points, 0);
    return recent.map((d) => {
      cumulative += d.points;
      return {
        date: d.date,
        label: d.date.slice(8) + "." + d.date.slice(5, 7),
        points: cumulative,
        earned: d.points,
      };
    });
  }, [series]);

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Season-Rang</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            <RankCard className="border-0 bg-transparent p-0" />
            <div>
              <p className="mb-1 text-xs text-muted-foreground">
                Punkte-Verlauf (letzte {POINTS_CHART_DAYS} Tage)
              </p>
              <ChartContainer config={pointsChartConfig} className="h-40 w-full">
                <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rank-line" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={rankCfg.from} />
                      <stop offset="100%" stopColor={rankCfg.to} />
                    </linearGradient>
                    <filter id="rank-glow" x="-30%" y="-60%" width="160%" height="220%">
                      <feDropShadow
                        dx="0"
                        dy="0"
                        stdDeviation="4"
                        floodColor={rankCfg.to}
                        floodOpacity="0.75"
                      />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                    fontSize={10}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    fontSize={10}
                    domain={["dataMin", "dataMax"]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="points"
                    stroke="url(#rank-line)"
                    strokeWidth={3.5}
                    strokeLinecap="round"
                    filter="url(#rank-glow)"
                    dot={false}
                    activeDot={{ r: 5, fill: rankCfg.to, strokeWidth: 0 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              Pro Tag bis zu 140 Punkte (Kalorien 35, Protein 25, KH 20, Fett 20 – mit
              Teilpunkten bei 60 % / 30 % je nach Abweichung, mehr Protein wird nicht
              bestraft, +40 Bonus bei allen vier voll getroffen). Darauf der
              Streak-Multiplikator (ab 3/7/14 Tagen ×1.1/×1.2/×1.3) sowie einmalige
              Meilenstein-Boni bei 7 (+100), 30 (+300) und 100 Tagen (+1000). Aktuell:{" "}
              {currentStreakDays} Tage Serie, Multiplikator ×
              {streakMultiplier.toFixed(1)}.
            </p>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  Alle Ränge ansehen
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader className="text-left">
                  <SheetTitle>Rang-Legende</SheetTitle>
                </SheetHeader>
                <div className="pb-6">
                  <RankLegend currentKey={rank.current.key} totalPoints={totalPoints} />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </section>

      <RankStatisticsSection />
    </div>
  );
}
