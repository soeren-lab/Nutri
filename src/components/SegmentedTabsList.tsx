import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Einheitliche, zentrierte Pill-Segmented-Control für 2er-Unter-Tabs (Zutaten/Rezepte/Entdecken). */
export function SegmentedTabsList({
  tabs,
  className,
}: {
  tabs: readonly (readonly [string, string])[];
  className?: string;
}) {
  return (
    <TabsList
      className={cn(
        "mx-auto grid h-auto w-full max-w-xs grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/70 p-1 shadow-inner",
        className,
      )}
    >
      {tabs.map(([value, label]) => (
        <TabsTrigger
          key={value}
          value={value}
          className="rounded-xl py-2 text-sm font-medium text-muted-foreground transition-all data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:[background:var(--primary-gradient)]"
        >
          {label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
