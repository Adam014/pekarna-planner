import { io } from "next/cache";
import Link from "next/link";
import { cache } from "react";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { today } from "@/lib/domain/time";
import { formatPrice, formatShortDay } from "@/lib/format";
import { readOrderTokens } from "@/lib/order-cookie";
import { orderByToken } from "@/lib/services/reservations.service";

/**
 * The orders this browser remembers, from today on, by pickup day. Cached
 * per request: the list and the day strip both read it.
 */
export const rememberedOrders = cache(async () => {
  const tokens = await readOrderTokens();
  if (tokens.length === 0) return [];
  // The time and the orders are per request, also in a runtime prefetch.
  await io();
  const now = Temporal.Now.instant();
  const from = today(now);
  const views = await Promise.all(tokens.map((t) => orderByToken(db, t, now)));
  return tokens
    .flatMap((token, i) => {
      const view = views[i];
      return view && view.pickupDate >= from ? [{ token, ...view }] : [];
    })
    .toSorted((a, b) => a.pickupDate.localeCompare(b.pickupDate));
});

/**
 * "Vaše objednávky" on the order page (R3): the orders this browser
 * remembers in its cookie, from today on. Renders nothing when there are
 * none. At most five lookups of one row each.
 */
export async function YourOrders() {
  const orders = await rememberedOrders();
  if (orders.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="your-orders">
      <h2 id="your-orders" className="text-lg font-semibold">
        Vaše objednávky
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {orders.map((order) => (
          <li key={order.token}>
            <Link
              href={`/objednavka/${order.token}`}
              className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="tabular-nums">
                <span className="font-medium">
                  {formatShortDay(order.pickupDate)}
                </span>
                <span className="text-muted-foreground">
                  {" · "}
                  {formatPrice(order.total)}
                </span>
              </span>
              <span className="flex items-center gap-3">
                <StatusBadge status={order.status} />
                <span aria-hidden className="text-lg text-muted-foreground">
                  ›
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
