"use client";

import { useState, type ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { BorderBeam } from "@/components/ui/border-beam";
import { cn } from "@/lib/utils";

/**
 * Einheitliche Suchleiste der App: Input mit Such-Icon und permanent
 * laufendem BorderBeam. Beim Fokus läuft der Beam schneller/größer.
 * Die Beam-Farben kommen aus dem Theme (--beam-from/--beam-to) und sind im
 * Dark Mode eigens aufgehellt, damit der Beam sichtbar leuchtet.
 */
export function SearchInputWithBeam({
  className,
  containerClassName,
  onFocus,
  onBlur,
  ...props
}: ComponentProps<typeof Input> & { containerClassName?: string }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", containerClassName)}
      style={{ boxShadow: isFocused ? "var(--beam-glow)" : undefined }}
    >
      <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        {...props}
        className={cn("pl-9 scroll-mt-0", className)}
        onFocus={(e) => {
          setIsFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
      />
      <BorderBeam
        size={isFocused ? 200 : 150}
        duration={isFocused ? 5 : 9}
        borderWidth={1.5}
        colorFrom="var(--beam-from)"
        colorTo="var(--beam-to)"
      />
    </div>
  );
}
