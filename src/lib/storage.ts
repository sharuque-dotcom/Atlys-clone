import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

// Local-disk adapter for development. In production swap for a UAE-region object store
// (AWS S3 me-central-1 / Azure Blob UAE North) with server-side encryption — the interface stays the same.
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

export const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
export const MAX_BYTES = 10 * 1024 * 1024;

export async function putObject(enterpriseId: string, file: File) {
  if (!ALLOWED_MIME.includes(file.type)) throw new Error("Only PDF, JPG, PNG, WEBP or HEIC files are accepted.");
  if (file.size > MAX_BYTES) throw new Error("Files must be 10 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const key = `${enterpriseId}/${randomUUID()}${path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, "")}`;
  const full = path.join(ROOT, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf);
  return { key, size: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

export async function getObject(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return readFile(full);
}
