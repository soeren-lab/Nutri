import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "@/lib/platform";

/** Werte für das Startbildschirm-Widget (nur Android-App). */
export type WidgetData = {
  /** Tag, zu dem die Werte gehören (YYYY-MM-DD). Das Widget zeigt nur Werte von heute. */
  date: string;
  kcal: number;
  kcalTarget: number;
  protein: number;
  proteinTarget: number;
  water: number;
  waterTarget: number;
};

type WidgetBridgePlugin = {
  update(data: WidgetData): Promise<void>;
};

const WidgetBridge = registerPlugin<WidgetBridgePlugin>("WidgetBridge");

export async function updateWidget(data: WidgetData): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await WidgetBridge.update(data);
  } catch {
    // Ältere App-Version ohne Widget-Plugin oder Plugin nicht verfügbar: Widget ist optional.
  }
}
