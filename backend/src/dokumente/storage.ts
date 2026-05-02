// Storage-Layer für Dokumente: schreibt Dateien auf die SSD,
// dedupliziert per sha256, liefert Lese-Streams.
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, createReadStream, statSync, unlinkSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

const ROOT = (): string => path.join(config.uploadsDir, "dokumente");

/** MIME → Datei-Endung-Mapping. */
function extFromMime(mime: string, fallbackName: string): string {
  const mapping: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (mapping[mime]) return mapping[mime];
  const ext = path.extname(fallbackName).slice(1).toLowerCase();
  return ext || "bin";
}

export interface StoredFile {
  sha256: string;
  storagePath: string; // relativ zu ROOT()
  groesseBytes: number;
}

/**
 * Schreibt einen Buffer dedupliziert ab.
 * Pfad: {YYYY}/{MM}/{sha[0:2]}/{sha}.{ext}
 */
export async function storeBuffer(
  buffer: Buffer,
  mime: string,
  originalName: string,
): Promise<StoredFile> {
  const sha = createHash("sha256").update(buffer).digest("hex");
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = extFromMime(mime, originalName);
  const rel = path.posix.join(yyyy, mm, sha.slice(0, 2), `${sha}.${ext}`);
  const abs = path.join(ROOT(), rel);

  if (!existsSync(path.dirname(abs))) {
    mkdirSync(path.dirname(abs), { recursive: true, mode: 0o700 });
  }

  if (!existsSync(abs)) {
    await writeFile(abs, buffer, { mode: 0o600 });
  }

  return { sha256: sha, storagePath: rel, groesseBytes: buffer.length };
}

export function absolutePath(relStoragePath: string): string {
  return path.join(ROOT(), relStoragePath);
}

export function fileExists(relStoragePath: string): boolean {
  return existsSync(absolutePath(relStoragePath));
}

export function fileSize(relStoragePath: string): number {
  try {
    return statSync(absolutePath(relStoragePath)).size;
  } catch {
    return 0;
  }
}

export function openReadStream(relStoragePath: string): NodeJS.ReadableStream {
  return createReadStream(absolutePath(relStoragePath));
}

/** Löscht eine Datei nur, wenn keine andere Zeile sie noch referenziert (Caller stellt das sicher). */
export function deleteFile(relStoragePath: string): void {
  try {
    unlinkSync(absolutePath(relStoragePath));
  } catch {
    /* best effort */
  }
}
