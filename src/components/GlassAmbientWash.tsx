/**
 * Ambient-Farbwash für den Experimental-Glass-Look: ein position:fixed-
 * Element, das exakt den Viewport abdeckt und dadurch bei jeder Scroll-
 * Position sichtbar bleibt – Glass-Karten (bg-card/bg-popover) haben so
 * immer etwas Farbiges zum Durchscheinen, auch weit unten auf langen Listen
 * (Planer, Zutaten). Bewusst kein background-attachment:fixed auf einem
 * großen Container: das wird auf mobilen WebViews oft ignoriert.
 *
 * Drei separate "Blob"-Divs statt einem Div mit drei background-image-
 * Layern: nur so lässt sich jede Farbfläche einzeln per CSS-transform
 * animieren (siehe ".wash-boost .ambient-wash__blob" in styles.css), ohne
 * bei jedem Frame das Gradient neu zu berechnen. Ohne aktive Animation ist
 * das Ergebnis pixelgleich zum vorherigen Einzel-Div.
 *
 * Größe/Position jedes Blobs stecken in CSS-Variablen (mit Fallback = alter,
 * flächiger Wert) statt fest im Gradient-String, damit z.B. Light-Glass
 * gezielt kleinere, konzentriertere Flecken statt eines flächigen Washs
 * bekommen kann (siehe ".glass-light .wash-boost" in styles.css), ohne hier
 * etwas anfassen zu müssen.
 */
export function GlassAmbientWash() {
  return (
    <div aria-hidden className="ambient-wash pointer-events-none fixed inset-0 z-0">
      <div
        className="ambient-wash__blob ambient-wash__blob--1"
        style={{
          backgroundImage:
            "radial-gradient(ellipse var(--wash-1-w, 110%) var(--wash-1-h, 80%) at var(--wash-1-x, 15%) var(--wash-1-y, 0%), var(--glow-1), transparent 75%)",
        }}
      />
      <div
        className="ambient-wash__blob ambient-wash__blob--2"
        style={{
          backgroundImage:
            "radial-gradient(ellipse var(--wash-2-w, 100%) var(--wash-2-h, 80%) at var(--wash-2-x, 100%) var(--wash-2-y, 45%), var(--glow-2), transparent 75%)",
        }}
      />
      <div
        className="ambient-wash__blob ambient-wash__blob--3"
        style={{
          backgroundImage:
            "radial-gradient(ellipse var(--wash-3-w, 110%) var(--wash-3-h, 90%) at var(--wash-3-x, 10%) var(--wash-3-y, 100%), var(--glow-3), transparent 75%)",
        }}
      />
    </div>
  );
}
