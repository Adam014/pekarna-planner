import type { OrderSummary } from "@/app/actions";

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
          className="flex items-baseline justify-between gap-4 px-4 py-3"
        >
          <span>
            <span className="font-medium tabular-nums">{item.quantity}×</span>{" "}
            {item.name}
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
