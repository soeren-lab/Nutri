import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { deletePlate, platesQuery, savePlate, type Plate, type PlateValues } from "@/lib/plates";

/** Eigene Teller/Schüsseln des Users inkl. Speichern und Löschen. */
export function usePlates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery({ ...platesQuery(), enabled: !!user });

  const save = useMutation({
    mutationFn: (v: {
      existing?: Plate | null;
      values: PlateValues;
      photo?: Blob | null;
      removePhoto?: boolean;
    }) => {
      if (!user) throw new Error("Nicht angemeldet");
      return savePlate({ userId: user.id, ...v });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["user-plates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (plate: Plate) => deletePlate(plate),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["user-plates"] });
      toast.success("Teller gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { plates: query.data ?? [], isLoading: query.isLoading, save, remove };
}
