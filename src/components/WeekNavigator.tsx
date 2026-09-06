import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWeekRange } from "@/lib/meal-plan";

export function WeekNavigator({
  weekStart,
  onPrev,
  onNext,
  onToday,
}: {
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
      <Button variant="ghost" size="icon" onClick={onPrev} aria-label="Vorherige Woche">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="min-w-0 text-center">
        <p className="truncate text-sm font-semibold">
          Woche vom {formatWeekRange(weekStart)}
        </p>
        <button
          type="button"
          onClick={onToday}
          className="text-xs text-primary hover:underline"
        >
          Heute
        </button>
      </div>
      <Button variant="ghost" size="icon" onClick={onNext} aria-label="Nächste Woche">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
