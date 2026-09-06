import { ArrowUpDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type SortOption =
  | "newest"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "time_asc"
  | "kcal_asc";

export const SORT_LABELS: Record<SortOption, string> = {
  newest: "Neueste zuerst",
  oldest: "Älteste zuerst",
  name_asc: "Name A–Z",
  name_desc: "Name Z–A",
  time_asc: "Zubereitungszeit (kurz → lang)",
  kcal_asc: "Kalorien pro Portion (niedrig → hoch)",
};

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (v: SortOption) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Sortieren"
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowUpDown className="h-4 w-4" />
        <span className="hidden sm:inline">Sortieren</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {(Object.keys(SORT_LABELS) as SortOption[]).map((k) => (
          <DropdownMenuItem
            key={k}
            onSelect={() => onChange(k)}
            className={cn("justify-between", value === k && "font-medium")}
          >
            {SORT_LABELS[k]}
            {value === k && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
