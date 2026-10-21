import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { db } from "@/integrations/db/client";
import type { Tables } from "@/integrations/db/types";
import { MEAL_PHOTO_BUCKET, removeMealPhoto } from "@/lib/meal-plan";

export type Plate = Tables<"user_plates">;

export const PLATE_SHAPES = [
  { value: "round", label: "Teller, rund" },
  { value: "oval", label: "Teller, oval/eckig" },
  { value: "bowl", label: "Schüssel" },
] as const;

export type PlateShape = (typeof PLATE_SHAPES)[number]["value"];

/** Maße eines Tellers, wie sie an die KI gehen (Zod, auch für die Server-Funktion). */
export const plateInfoSchema = z.object({
  name: z.string().min(1).max(80),
  shape: z.enum(["round", "oval", "bowl"]),
  width_cm: z.number().positive().max(100),
  length_cm: z.number().positive().max(100).nullish(),
  depth_cm: z.number().positive().max(50),
  capacity_ml: z.number().positive().max(10000).nullish(),
});

export type PlateInfo = z.infer<typeof plateInfoSchema>;

export function plateToInfo(p: Plate): PlateInfo {
  return {
    name: p.name,
    shape: PLATE_SHAPES.some((s) => s.value === p.shape) ? (p.shape as PlateShape) : "round",
    width_cm: Number(p.width_cm),
    length_cm: p.length_cm != null ? Number(p.length_cm) : null,
    depth_cm: Number(p.depth_cm),
    capacity_ml: p.capacity_ml != null ? Number(p.capacity_ml) : null,
  };
}

const n = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

/** Kurzbeschreibung der Maße (Anzeige und KI-Prompt). */
export function describePlate(p: PlateInfo): string {
  const parts: string[] = [];
  if (p.shape === "oval") {
    parts.push(
      p.length_cm
        ? `Teller (oval/eckig), ${n(p.width_cm)} × ${n(p.length_cm)} cm`
        : `Teller (oval/eckig), Breite ${n(p.width_cm)} cm`,
    );
  } else if (p.shape === "bowl") {
    parts.push(`Schüssel, Durchmesser ${n(p.width_cm)} cm`);
  } else {
    parts.push(`Teller (rund), Durchmesser ${n(p.width_cm)} cm`);
  }
  parts.push(`Tiefe ${n(p.depth_cm)} cm`);
  if (p.capacity_ml) parts.push(`Fassungsvermögen ${Math.round(p.capacity_ml)} ml`);
  return parts.join(", ");
}

export async function fetchPlates(): Promise<Plate[]> {
  const { data, error } = await db.from("user_plates").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export const platesQuery = () =>
  queryOptions({ queryKey: ["user-plates"], queryFn: fetchPlates, staleTime: 60_000 });

export type PlateValues = {
  name: string;
  shape: PlateShape;
  width_cm: number;
  length_cm: number | null;
  depth_cm: number;
  capacity_ml: number | null;
};

/** Legt einen Teller an oder aktualisiert ihn; `photo` ersetzt das Foto, `removePhoto` löscht es. */
export async function savePlate(input: {
  userId: string;
  existing?: Plate | null;
  values: PlateValues;
  photo?: Blob | null;
  removePhoto?: boolean;
}): Promise<Plate> {
  const id = input.existing?.id ?? crypto.randomUUID();
  let photoPath = input.existing?.photo_path ?? null;
  if (input.photo) {
    photoPath = `${input.userId}/plate-${id}.jpg`;
    const { error } = await db.storage
      .from(MEAL_PHOTO_BUCKET)
      .upload(photoPath, input.photo, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
  } else if (input.removePhoto && photoPath) {
    await removeMealPhoto(photoPath).catch(() => {});
    photoPath = null;
  }
  const { data, error } = await db
    .from("user_plates")
    .upsert({ id, user_id: input.userId, ...input.values, photo_path: photoPath })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlate(plate: Plate): Promise<void> {
  const { error } = await db.from("user_plates").delete().eq("id", plate.id);
  if (error) throw error;
  if (plate.photo_path) await removeMealPhoto(plate.photo_path).catch(() => {});
}

const LAST_PLATE_KEY = "nutri:last-plate-id";

/** Zuletzt gewählter Teller (reine Bequemlichkeit, nur lokal). */
export function getLastPlateId(): string | null {
  try {
    return localStorage.getItem(LAST_PLATE_KEY);
  } catch {
    return null;
  }
}

export function setLastPlateId(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_PLATE_KEY, id);
    else localStorage.removeItem(LAST_PLATE_KEY);
  } catch {
    // Storage nicht verfügbar – nicht kritisch
  }
}
