import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiPostPdf } from "@/lib/db-client";
import { loadCookbookDoc } from "@/lib/cookbook-doc";
import { renderCookbookHtml } from "@/lib/cookbook-html";
import { saveFile } from "@/lib/save-file";

/** Kochbuch als PDF: Vorlage (HTML) im Browser bauen, die NAS druckt sie mit Chromium zum PDF. */
export function usePdfExport() {
  return useMutation({
    mutationFn: async (cookbookId: string) => {
      const { doc, filename } = await loadCookbookDoc(cookbookId);
      const res = await apiPostPdf("/pdf/cookbook", { html: renderCookbookHtml(doc) });
      if (res.error || !res.data)
        throw new Error(res.error?.message ?? "PDF-Export fehlgeschlagen");
      await saveFile(res.data, filename, doc.title);
      return filename;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen"),
  });
}
