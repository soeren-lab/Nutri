/** Stabile Client-ID für Formular-Drafts. */
export function makeUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `uid_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}
