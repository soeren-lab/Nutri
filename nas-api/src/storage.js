import { mkdir, readFile, writeFile, rm, readdir, stat } from "node:fs/promises";
import { join, dirname, normalize, sep } from "node:path";
import { query, esc } from "./db.js";
import { ApiError } from "./query.js";
import { storageCanWrite, storageReadAnyAuthed } from "./policies.js";

export const BUCKETS = new Set([
  "avatars",
  "recipe-images",
  "ingredient-images",
  "cookbook-covers",
  "meal-photos",
]);

const ROOT = process.env.STORAGE_DIR || "/data/storage";

function resolvePath(bucket, path) {
  if (!BUCKETS.has(bucket)) throw new ApiError("Bucket nicht gefunden", "404");
  const clean = normalize(String(path || "")).replace(/^[/\\]+/, "");
  if (!clean || clean.split(sep).includes("..") || clean.includes("\0")) throw new ApiError("Ungültiger Pfad", "400");
  return { clean: clean.split(sep).join("/"), file: join(ROOT, bucket, clean) };
}

/** Darf `uid` die Datei lesen? (Nachbau der storage.objects-Policies) */
export async function canRead(bucket, path, uid) {
  if (storageReadAnyAuthed.has(bucket)) return true;
  if (path.split("/")[0] === uid) return true;
  if (bucket === "ingredient-images") {
    const [r] = await query(
      `SELECT 1 AS x FROM ingredients_master WHERE image_url = ${esc(path)} AND is_published = 1 LIMIT 1`,
    );
    return Boolean(r);
  }
  return false;
}

export async function putObject(bucket, path, uid, body, upsert) {
  const { clean, file } = resolvePath(bucket, path);
  if (!storageCanWrite(bucket, clean, uid)) throw new ApiError("new row violates row-level security policy", "403");
  if (!upsert) {
    try {
      await stat(file);
      throw new ApiError("The resource already exists", "409");
    } catch (e) {
      if (e instanceof ApiError) throw e;
    }
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, body);
  return clean;
}

export async function getObject(bucket, path) {
  const { file } = resolvePath(bucket, path);
  try {
    return await readFile(file);
  } catch {
    throw new ApiError("Object not found", "404");
  }
}

export async function removeObjects(bucket, paths, uid) {
  const removed = [];
  for (const p of paths) {
    const { clean, file } = resolvePath(bucket, p);
    if (!storageCanWrite(bucket, clean, uid)) continue;
    await rm(file, { force: true });
    removed.push({ name: clean, bucket_id: bucket });
  }
  return removed;
}

export async function listObjects(bucket, prefix, uid) {
  const { file } = resolvePath(bucket, prefix || uid);
  const first = String(prefix || "").split("/")[0];
  if (first !== uid && !storageReadAnyAuthed.has(bucket)) return [];
  try {
    const names = await readdir(file, { withFileTypes: true });
    return names.map((d) => ({ name: d.name, id: d.name, metadata: {} }));
  } catch {
    return [];
  }
}

/** Alle Dateien eines Users löschen (Konto löschen). */
export async function removeUserFiles(uid) {
  for (const bucket of BUCKETS) await rm(join(ROOT, bucket, uid), { recursive: true, force: true });
}
