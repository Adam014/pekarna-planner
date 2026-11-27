/**
 * Product photos: normalised on the server and stored in Vercel Blob
 * (public store, docs/research/reports/product-photos-2026-11.md).
 */
import "server-only";
import { del, put } from "@vercel/blob";
import sharp from "sharp";

/** What the browser sends after shrinking the photo; Server Actions take 1 MB. */
export const MAX_UPLOAD_BYTES = 900 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
/** Square, enough for a 2x thumbnail and the product dialog. */
const SIZE = 640;

export type PhotoError = "not_configured" | "invalid_file";

export function canStorePhotos(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Re-encodes the photo as a square WebP (which also drops EXIF data such
 * as GPS) and uploads it. Returns the public URL.
 */
export async function storePhoto(
  productId: string,
  file: File,
): Promise<{ url: string } | { error: PhotoError }> {
  if (!canStorePhotos()) return { error: "not_configured" };
  if (!TYPES.has(file.type) || file.size === 0 || file.size > MAX_UPLOAD_BYTES)
    return { error: "invalid_file" };
  let body: Buffer;
  try {
    body = await sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return { error: "invalid_file" };
  }
  const blob = await put(`products/${productId}.webp`, body, {
    access: "public",
    contentType: "image/webp",
    // A new name per upload, so caches never show the old photo.
    addRandomSuffix: true,
  });
  return { url: blob.url };
}

/** Deletes an uploaded photo; demo photos under public/ are left alone. */
export async function deletePhoto(url: string | null): Promise<void> {
  if (!url?.startsWith("https://") || !canStorePhotos()) return;
  try {
    await del(url);
  } catch {
    // An orphaned file costs little; the product is already updated.
  }
}
