"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Injects a block of CSS into the document head exactly once (keyed by id).
 */
function useGlobalStyles(css: string, id: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }, [css, id]);
}

const BORDER_BEAM_STYLES = `
@property --border-beam-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes border-beam-spin {
  from { --border-beam-angle: 0deg; }
  to { --border-beam-angle: 360deg; }
}
`;

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  /** Match iOS-style squircle corners (requires Chrome 139+) */
  squircle?: boolean;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  borderWidth = 1.5,
  squircle = false,
}: BorderBeamProps) {
  useGlobalStyles(BORDER_BEAM_STYLES, "border-beam-styles");

  const squircleStyle = squircle
    ? ({ cornerShape: "squircle" } as React.CSSProperties)
    : {};

  const arc = Math.max(5, Math.min(180, size / 4));

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className,
      )}
      style={{
        ...squircleStyle,
        padding: `${borderWidth}px`,
        background: `conic-gradient(from var(--border-beam-angle,0deg) at 50% 50%, transparent 0deg, ${colorFrom} ${arc * 0.5}deg, ${colorTo} ${arc}deg, transparent ${arc * 1.6}deg)`,
        animation: `border-beam-spin ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
        WebkitMask:
          "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
      }}
    />
  );
}

export default BorderBeam;
