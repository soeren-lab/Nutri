import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { useUserAvatar } from "@/hooks/use-user-avatar";
import { useUsername } from "@/hooks/use-username";

/** Sektion "Profilbild" – Anzeige, Upload (Galerie) und Entfernen. */
export function AvatarUpload() {
  const { username } = useUsername();
  const { avatarUrl, isLoading, upload, remove } = useUserAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const shown = preview ?? avatarUrl;
  const busy = upload.isPending || remove.isPending;

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    try {
      await upload.mutateAsync(file);
      toast.success("Profilbild gespeichert");
    } catch (e) {
      setPreview(null);
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen");
    } finally {
      URL.revokeObjectURL(localUrl);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">Profilbild</p>
        <p className="text-xs text-muted-foreground">
          Wird überall neben deinem Username angezeigt – z.&nbsp;B. im Community-Bereich.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatar
          label={username ?? "?"}
          avatarUrl={shown}
          className="h-16 w-16 text-lg"
        />

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPick(e.target.files?.[0])}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || isLoading}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="mr-2 h-4 w-4" />
            )}
            Bild ändern
          </Button>

          {avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                try {
                  await remove.mutateAsync();
                  setPreview(null);
                  toast.success("Profilbild entfernt");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Fehler");
                }
              }}
            >
              {remove.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              )}
              Entfernen
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
