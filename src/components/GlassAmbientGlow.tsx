/**
 * Dezente, fixed-position Glow-Blobs für den Experimental-Glass-Look.
 * Wird einmal im Authenticated-Shell gerendert, wirkt dadurch auf jedem Screen.
 */
export function GlassAmbientGlow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute rounded-full"
        style={{
          width: 320,
          height: 320,
          top: -120,
          left: -100,
          background: "var(--glow-1)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 280,
          height: 280,
          top: "30vh",
          right: -120,
          background: "var(--glow-2)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: 300,
          height: 300,
          bottom: -100,
          left: -80,
          background: "var(--glow-3)",
          filter: "blur(80px)",
        }}
      />
    </div>
  );
}
