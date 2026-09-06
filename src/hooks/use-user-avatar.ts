import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  avatarQuery,
  getAvatarSignedUrl,
  removeAvatar,
  saveAvatarPath,
  uploadAvatar,
} from "@/lib/avatar";

/** Profilbild des eingeloggten Users lesen, hochladen und entfernen. */
export function useUserAvatar() {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const pathQuery = useQuery(avatarQuery(user?.id));
  const path = pathQuery.data ?? null;

  const urlQuery = useQuery({
    queryKey: ["avatar-signed", path ?? "none"],
    enabled: !!path,
    queryFn: () => getAvatarSignedUrl(path),
    staleTime: 1000 * 60 * 60,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["user-avatar"] });
    void qc.invalidateQueries({ queryKey: ["avatar-signed"] });
    void qc.invalidateQueries({ queryKey: ["user-profile"] });
    void qc.invalidateQueries({ queryKey: ["community-ingredients"] });
    void qc.invalidateQueries({ queryKey: ["community-recipes"] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Nicht angemeldet");
      const newPath = await uploadAvatar(user.id, file);
      await saveAvatarPath(user.id, newPath);
      if (path && path !== newPath) {
        await removeAvatarFile(path);
      }
      return newPath;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      await removeAvatar(user.id, path);
    },
    onSuccess: invalidate,
  });

  return {
    avatarPath: path,
    avatarUrl: urlQuery.data ?? null,
    isLoading: loading || pathQuery.isLoading,
    upload,
    remove,
  };
}

async function removeAvatarFile(path: string) {
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.storage.from("avatars").remove([path]);
}
