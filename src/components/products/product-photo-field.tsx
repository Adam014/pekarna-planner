"use client";

import Image from "next/image";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  removeProductPhoto,
  uploadProductPhoto,
} from "@/app/(staff)/vyrobky/actions";
import { Button } from "@/components/ui/button";

/** Longest side sent to the server; it makes the final square itself. */
const MAX_SIDE = 1280;
/** Under the 1 MB Server Action limit, with room for the form fields. */
const MAX_BYTES = 900 * 1024;

/**
 * Shrinks a phone photo in the browser (several MB) to a WebP small enough
 * for a Server Action. Null when the browser cannot read the file.
 */
async function shrink(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob && blob.size <= MAX_BYTES) return blob;
  }
  return null;
}

/** The product's photo in the edit dialog: upload, replace or remove. */
export function ProductPhotoField({
  productId,
  name,
  imageUrl,
}: {
  productId: string;
  name: string;
  imageUrl: string | null;
}) {
  const inputId = useId();
  const [url, setUrl] = useState(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      const blob = await shrink(file);
      if (!blob) {
        setError("Tuhle fotku se nepodařilo načíst. Zkuste JPG nebo PNG.");
        return;
      }
      const data = new FormData();
      data.set("productId", productId);
      data.set("photo", new File([blob], "photo.webp", { type: blob.type }));
      const result = await uploadProductPhoto({ status: "idle" }, data);
      if (result.status === "error") setError(result.message);
      if (result.status === "saved") {
        setUrl(result.imageUrl);
        toast.success("Fotka uložena", { id: "photo-saved" });
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeProductPhoto(productId);
      if (result.status === "error") setError(result.message);
      if (result.status === "saved") setUrl(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Fotka</p>
      <div className="flex items-center gap-4">
        {url ? (
          <Image
            src={url}
            alt={name}
            width={96}
            height={96}
            sizes="96px"
            className="size-24 shrink-0 rounded-lg border object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="size-24 shrink-0 rounded-lg border border-dashed bg-muted/40"
          />
        )}
        <div className="flex flex-wrap gap-2">
          {/* The label is the button; the input stays reachable by keyboard. */}
          <label
            htmlFor={inputId}
            aria-disabled={pending || undefined}
            className="relative inline-flex h-11 cursor-pointer items-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            {pending ? "Ukládám…" : url ? "Změnit fotku" : "Nahrát fotku"}
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              disabled={pending}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload(file);
              }}
            />
          </label>
          {url && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-muted-foreground"
              disabled={pending}
              onClick={remove}
            >
              Odebrat
            </Button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
