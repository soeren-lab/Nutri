import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  bumpTemplateUseCount,
  deleteQuickEntryTemplate,
  quickEntryTemplatesQuery,
  updateQuickEntryTemplate,
  upsertQuickEntryTemplate,
  type QuickEntryValues,
} from "@/lib/quick-entries";

export function useQuickEntryTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery(quickEntryTemplatesQuery());
  const templates = query.data ?? [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["quick-entry-templates"] });
  };

  const saveTemplate = useMutation({
    mutationFn: (v: QuickEntryValues) => {
      if (!user) throw new Error("Nicht angemeldet");
      return upsertQuickEntryTemplate(user.id, v);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Als Vorlage gespeichert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bumpUse = useMutation({
    mutationFn: (id: string) => {
      const current = templates.find((t) => t.id === id)?.use_count ?? 0;
      return bumpTemplateUseCount(id, current);
    },
    onSuccess: invalidate,
  });

  const updateTemplate = useMutation({
    mutationFn: (v: { id: string } & QuickEntryValues) => {
      const { id, ...values } = v;
      return updateQuickEntryTemplate(id, values);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Vorlage aktualisiert");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTemplate = useMutation({
    mutationFn: (id: string) => deleteQuickEntryTemplate(id),
    onSuccess: () => {
      invalidate();
      toast.success("Vorlage gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    templates,
    isLoading: query.isLoading,
    saveTemplate,
    bumpUse,
    updateTemplate,
    removeTemplate,
  };
}
