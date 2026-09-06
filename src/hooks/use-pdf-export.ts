import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { generateCookbookPdf } from "@/lib/cookbook-pdf.functions";

export function usePdfExport() {
  const gen = useServerFn(generateCookbookPdf);
  return useMutation({
    mutationFn: async (cookbookId: string) => {
      const res = await gen({ data: { cookbookId } });
      const binary = atob(res.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return res.filename;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen"),
  });
}
