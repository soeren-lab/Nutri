/**
 * Führt `worker` für jedes Element aus, mit höchstens `limit` gleichzeitig
 * laufenden Aufrufen. Ein einzelner Fehlschlag bricht die übrigen Elemente
 * nicht ab (wichtig für einen Hintergrund-Sync: ein gelöschtes/fehlerhaftes
 * Rezept darf das Warmlaufen des Caches für alle anderen nicht stoppen).
 */
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  async function run() {
    while (index < items.length) {
      const item = items[index++];
      try {
        await worker(item);
      } catch (err) {
        console.warn("[Offline-Sync] Element übersprungen", err);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
