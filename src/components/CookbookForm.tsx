import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ImageIcon, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  createCookbook,
  updateCookbook,
  uploadCookbookCover,
  getCookbookCoverSignedUrl,
  type Cookbook,
} from "@/lib/cookbooks";
import { useQuery } from "@tanstack/react-query";

export function CookbookForm({ existing }: { existing?: Cookbook }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [coverPath, setCoverPath] = useState<string | null>(existing?.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const { data: signedUrl } = useQuery({
    queryKey: ["cookbook-cover", coverPath],
    queryFn: () => (coverPath ? getCookbookCoverSignedUrl(coverPath) : Promise.resolve(null)),
    enabled: !!coverPath && !localPreview,
    staleTime: 1000 * 60 * 60,
  });

  const previewUrl = localPreview ?? signedUrl ?? null;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setLocalPreview(URL.createObjectURL(f));
  }

  function removeImage() {
    setFile(null);
    setLocalPreview(null);
    setCoverPath(null);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Titel erforderlich");
      let path = coverPath;
      if (file) {
        setUploading(true);
        const { data: userRes } = await supabase.auth.getUser();
        const uid = userRes.user?.id;
        if (!uid) throw new Error("Nicht angemeldet");
        path = await uploadCookbookCover(uid, file);
        setUploading(false);
      }
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        cover_image_url: path,
      };
      if (existing) {
        return updateCookbook(existing.id, payload);
      }
      return createCookbook(payload);
    },
    onSuccess: (cb) => {
      qc.invalidateQueries({ queryKey: ["cookbooks"] });
      qc.invalidateQueries({ queryKey: ["cookbooks", cb.id] });
      toast.success(existing ? "Kochbuch aktualisiert" : "Kochbuch erstellt");
      navigate({ to: "/cookbooks/$id", params: { id: cb.id } });
    },
    onError: (e) => {
      setUploading(false);
      toast.error(e instanceof Error ? e.message : "Fehler");
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveMut.mutate();
      }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label>Cover-Bild</Label>
        <div className="flex items-start gap-4">
          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent">
              <Upload className="h-4 w-4" />
              Bild wählen
              <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
            </label>
            {(previewUrl || coverPath) && (
              <Button type="button" variant="ghost" size="sm" onClick={removeImage} className="gap-1.5">
                <X className="h-4 w-4" /> Entfernen
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mein Lieblingskochbuch"
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Worum geht es in diesem Kochbuch?"
          rows={4}
          maxLength={1000}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => navigate({ to: "/cookbooks" })}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={saveMut.isPending || uploading}>
          {saveMut.isPending || uploading ? "Speichere…" : existing ? "Speichern" : "Erstellen"}
        </Button>
      </div>
    </form>
  );
}
