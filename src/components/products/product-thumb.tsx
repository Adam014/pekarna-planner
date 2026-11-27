import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * A product's photo as a small square. Without a photo it keeps the space
 * as a plain tile, so names stay in one column.
 */
export function ProductThumb({
  src,
  className,
}: {
  src: string | null;
  className?: string;
}) {
  const box = cn("size-14 shrink-0 rounded-lg sm:size-16", className);
  if (!src) return <span aria-hidden className={cn(box, "bg-muted")} />;
  return (
    // Decorative: the product name is right next to it.
    <Image
      src={src}
      alt=""
      width={64}
      height={64}
      sizes="64px"
      className={cn(box, "object-cover")}
    />
  );
}
