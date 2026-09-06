import { cn } from "@/lib/utils";

/**
 * Buchstaben-Avatar mit optionalem Profilbild – gleiches Muster wie im Community-Grid.
 */
export function UserAvatar({
  label,
  avatarUrl,
  className,
  ring,
}: {
  /** Username o.Ä.; erster Buchstabe dient als Fallback */
  label: string;
  avatarUrl?: string | null;
  className?: string;
  ring?: boolean;
}) {
  const letter = label.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-primary-foreground [background:var(--primary-gradient)]",
        ring && "ring-1 ring-primary ring-offset-1 ring-offset-background",
        className,
      )}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        letter
      )}
    </span>
  );
}
