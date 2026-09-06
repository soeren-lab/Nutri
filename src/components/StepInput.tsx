import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function StepInput({
  value,
  onChange,
  onRemove,
  index,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  index: number;
}) {
  return (
    <div className="flex gap-2">
      <div className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
        {index + 1}
      </div>
      <Textarea
        placeholder="Schritt beschreiben…"
        aria-label={`Schritt ${index + 1}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={`Schritt ${index + 1} entfernen`}
        className="mt-1"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
