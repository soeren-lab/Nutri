import { supabase } from "@/integrations/supabase/client";

export type PatchNoteSection = {
  id: string;
  subtitle: string;
  content: string;
  sort_order: number;
};

export type PatchNote = {
  id: string;
  title: string;
  created_at: string;
  sections: PatchNoteSection[];
};

export type PatchNoteDraft = {
  title: string;
  sections: { subtitle: string; content: string }[];
};

/** Prüft, ob der aktuelle User die Admin-Rolle hat. */
export function isAdminQuery(userId: string | undefined) {
  return {
    queryKey: ["is-admin", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId!,
        _role: "admin",
      });
      if (error) throw error;
      return data === true;
    },
  };
}

async function fetchNotes(): Promise<PatchNote[]> {
  const { data, error } = await supabase
    .from("patch_notes")
    .select("id, title, created_at, patch_note_sections(id, subtitle, content, sort_order)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    created_at: n.created_at,
    sections: [...(n.patch_note_sections ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

export function patchNotesQuery() {
  return { queryKey: ["patch-notes"], queryFn: fetchNotes };
}

/** Alle Patch Notes, die der User noch nicht gesehen hat – älteste zuerst. */
export function unseenPatchNotesQuery(userId: string | undefined) {
  return {
    queryKey: ["patch-notes", "unseen", userId ?? "anon"],
    enabled: !!userId,
    queryFn: async (): Promise<PatchNote[]> => {
      const [notes, seen] = await Promise.all([
        fetchNotes(),
        supabase
          .from("user_seen_patch_notes")
          .select("patch_note_id")
          .eq("user_id", userId!),
      ]);
      if (seen.error) throw seen.error;
      const seenIds = new Set((seen.data ?? []).map((s) => s.patch_note_id));
      return notes
        .filter((n) => !seenIds.has(n.id))
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
  };
}

export async function createPatchNote(userId: string, draft: PatchNoteDraft) {
  const title = draft.title.trim();
  if (!title) throw new Error("Überschrift fehlt");
  const { data, error } = await supabase
    .from("patch_notes")
    .insert({ title, published_by: userId })
    .select("id")
    .single();
  if (error) throw error;

  const sections = draft.sections
    .map((s, i) => ({
      patch_note_id: data.id,
      subtitle: s.subtitle.trim(),
      content: s.content.trim(),
      sort_order: i,
    }))
    .filter((s) => s.subtitle || s.content);

  if (sections.length > 0) {
    const res = await supabase.from("patch_note_sections").insert(sections);
    if (res.error) throw res.error;
  }
  return data.id;
}

export async function deletePatchNote(id: string) {
  const { error } = await supabase.from("patch_notes").delete().eq("id", id);
  if (error) throw error;
}

export async function markPatchNoteSeen(userId: string, patchNoteId: string) {
  const { error } = await supabase
    .from("user_seen_patch_notes")
    .upsert({ user_id: userId, patch_note_id: patchNoteId });
  if (error) throw error;
}
