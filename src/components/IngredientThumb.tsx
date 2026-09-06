import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedIngredientImage } from "@/hooks/use-signed-image";

const SIZES = {
  sm: "h-12 w-12 rounded-md",
  md: "h-16 w-16 rounded-xl",
  lg: "h-20 w-20 rounded-xl",
} as const;

export function IngredientThumb({
  path,
  className,
  size = "sm",
}: {
  path: string | null | undefined;
  className?: string;
  size?: keyof typeof SIZES;
}) {
  const { data: url, status, fetchStatus, error, dataUpdatedAt } = useSignedIngredientImage(path);
  if (path && !url) {
    console.warn(
      `[IngredientThumb] Kein Bild für ${path}: status=${status} fetchStatus=${fetchStatus} dataUpdatedAt=${dataUpdatedAt} error=${error instanceof Error ? error.message : String(error ?? "")}`,
    );
  }
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border border-border bg-muted",
        SIZES[size],
        size !== "sm" && "shadow-sm",
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageIcon className={size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
        </div>
      )}
    </div>
  );
}
