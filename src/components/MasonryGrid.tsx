import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Pinterest-artiges Masonry-Layout via CSS-Spalten (2 Spalten mobil, mehr ab sm). */
export function MasonryGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
