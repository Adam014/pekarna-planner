import type { OrderSummary } from "@/app/actions";
import { ProductThumb } from "@/components/products/product-thumb";

/** What was ordered and the total; on the success screen and the order page. */
export function OrderItems({
  items,
  total,
}: Pick<OrderSummary, "items" | "total">) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((item) => (
        <li
          key={item.name}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <span className="flex min-w-0 items-center gap-3">
            <ProductThumb src={item.imageUrl} className="size-12 sm:size-12" />
            <span>
              <span className="font-medium tabular-nums">{item.quantity}×</span>{" "}
              {item.name}
            </span>
          </span>
          <span className="tabular-nums text-muted-foreground">
            {item.price}
          </span>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-4 bg-muted/50 px-4 py-3 font-semibold">
        <span>
          Celkem{" "}
          <span className="font-normal text-muted-foreground">
            (platí se v pekárně)
          </span>
        </span>
        <span className="tabular-nums">{total}</span>
      </li>
    </ul>
  );
}
