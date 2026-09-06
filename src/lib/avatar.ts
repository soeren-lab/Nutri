import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

/** Lädt ein Profilbild in den Storage und gibt den Pfad zurück. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const type = file.type.toLowerCase();
  const nameLower = file.name.toLowerCase();
  if (
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif") ||
    type === "image/heic" ||
    type === "image/heif"
  ) {
    throw new Error(
      "HEIC/HEIF wird von Browsern nicht angezeigt. Bitte als JPG, PNG oder WebP hochladen.",
    );
  }
  if (type && !SUPPORTED_IMAGE_TYPES.includes(type)) {
    throw new Error(
      "Nicht unterstütztes Bildformat. Bitte JPG, PNG, WebP, GIF oder AVIF verwenden.",
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Bild ist zu groß (max. 5 MB).");
  }
  const ext = (nameLower.split(".").pop() || "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: type || undefined,
  });
  if (error) throw error;
  return path;
}

/** Signierte URL für einen Avatar-Pfad (7 Tage). */
export async function getAvatarSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error) return null;
  return data.signedUrl;
}

/** Signierte URLs für mehrere Avatar-Pfade (Pfad → URL). */
export async function getAvatarSignedUrls(
  paths: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return map;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(unique, 60 * 60 * 24 * 7);
  if (error || !data) return map;
  for (const row of data) {
    if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  }
  return map;
}

/** Liest den Avatar-Pfad des eingeloggten Users. */
export function avatarQuery(userId: string | undefined) {
  return {
    queryKey: ["user-avatar", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("user_profile")
        .select("avatar_url")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data?.avatar_url ?? null;
    },
  };
}

/** Speichert (oder löscht) den Avatar-Pfad im Profil. */
export async function saveAvatarPath(userId: string, path: string | null) {
  const { error } = await supabase
    .from("user_profile")
    .upsert({ user_id: userId, avatar_url: path }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Entfernt das Profilbild inkl. Storage-Datei. */
export async function removeAvatar(userId: string, path: string | null) {
  if (path) {
    await supabase.storage.from(BUCKET).remove([path]);
  }
  await saveAvatarPath(userId, null);
}
