export type ResizedImage = {
  /** JPEG-Blob (z. B. für den Upload in den Storage). */
  blob: Blob;
  /** Base64 ohne data:-Präfix (für die KI-Auswertung). */
  base64: string;
  /** Objekt-URL für die Vorschau – nach Gebrauch mit URL.revokeObjectURL freigeben. */
  previewUrl: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Foto konnte nicht gelesen werden"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // Fallback unten
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Skaliert ein Foto auf höchstens `maxSide` px (längste Seite) und kodiert es als JPEG. */
export async function resizeImage(
  file: File,
  maxSide = 1280,
  quality = 0.8,
): Promise<ResizedImage> {
  const { source, width, height } = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Foto konnte nicht verarbeitet werden");
  ctx.drawImage(source, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Foto konnte nicht verarbeitet werden"))),
      "image/jpeg",
      quality,
    ),
  );
  return { blob, base64: await blobToBase64(blob), previewUrl: URL.createObjectURL(blob) };
}
