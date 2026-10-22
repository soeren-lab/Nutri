import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SettingsSubPage } from "@/components/settings/SettingsSubPage";
import { PHOTO_SCAN_MODELS, setPhotoScanModel, usePhotoScanModel } from "@/lib/photo-scan-model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/profile/settings/photo-scan")({
  head: () => ({
    meta: [
      { title: "Foto-Scan-Modell" },
      {
        name: "description",
        content: "KI-Modell für den Foto-Scan wählen: günstig oder genau.",
      },
      { property: "og:title", content: "Foto-Scan-Modell" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PhotoScanModelPage,
});

function PhotoScanModelPage() {
  const current = usePhotoScanModel();
  return (
    <SettingsSubPage
      title="Foto-Scan-Modell"
      description="Welche KI deine Essensfotos auswertet. Die Wahl gilt für dieses Gerät und für alle neuen Scans."
    >
      <div className="space-y-3">
        {PHOTO_SCAN_MODELS.map((m) => {
          const active = m.id === current;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setPhotoScanModel(m.id)}
              aria-pressed={active}
              className={cn(
                "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {active && <Check className="size-3.5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {m.label} <span className="font-normal text-muted-foreground">· {m.cost}</span>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Die Kosten sind Richtwerte und hängen von der Bibliotheksgröße und den Fotos ab. Was ein
        Scan tatsächlich gekostet hat, siehst du nach dem Scan und unter „Mein Guthaben".
      </p>
    </SettingsSubPage>
  );
}
