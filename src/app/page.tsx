import { randomUUID } from "node:crypto";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { piecesLeft } from "@/components/order/messages";
import {
  OrderForm,
  type FormDay,
  type FormProduct,
} from "@/components/order/order-form";
import { YourOrders } from "@/components/order/your-orders";
import { db } from "@/lib/db";
import { addDays, today } from "@/lib/domain/time";
import { formatDayOn, formatPrice } from "@/lib/format";
import { orderOffer } from "@/lib/services/online-order.service";

const WEEKDAYS = ["po", "út", "st", "čt", "pá", "so", "ne"];
/** "zbývají 3 ks" only when this few are left, so the list stays quiet. */
const FEW_LEFT = 5;

// The public order form (R2). The page stays synchronous: the header and
// the login link are the static shell; the offer is live (availability and
// the cutoff), so it renders per request inside Suspense, uncached.
export default function OrderPage() {
  return (
    <>
      {/* A slim top bar as on store pages: the brand, the staff login. */}
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-4 px-4">
          <Link
            href="/"
            className="flex min-h-11 items-center text-lg font-semibold tracking-tight"
          >
            Pekárna
          </Link>
          {/* For the bakery's staff; out of the customer's way. */}
          <Link
            href="/prihlaseni"
            className="-mr-3 inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Přihlášení pro pekárnu
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-8 pb-6 sm:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Objednávka pečiva
        </h1>
        <Suspense
          fallback={<p className="text-muted-foreground">Načítám nabídku…</p>}
        >
          <OrderSection />
        </Suspense>
      </main>
    </>
  );
}

async function OrderSection() {
  // The time and the order key are per request (Cache Components).
  await io();
  const now = Temporal.Now.instant();
  const { cutoff, products, days } = await orderOffer(db, now);
  const tomorrow = addDays(today(now), 1);

  // The orders this browser remembers (R3); reads its cookie, so it streams
  // on its own.
  const yourOrders = (
    <Suspense fallback={null}>
      <YourOrders />
    </Suspense>
  );

  if (days.length === 0) {
    return (
      <>
        {yourOrders}
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          Teď nejde nic objednat. Zkuste to prosím později.
        </p>
      </>
    );
  }

  const formProducts: FormProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    priceLabel: formatPrice(p.price),
  }));
  const bakedOn = new Map(
    products.map((p) => [
      p.id,
      p.bakeDays
        .toSorted((a, b) => a - b)
        .map((d) => WEEKDAYS[d - 1])
        .join(", "),
    ]),
  );
  const formDays: FormDay[] = days.map(({ date, items }) => {
    const plain = Temporal.PlainDate.from(date);
    return {
      date,
      chip:
        date === tomorrow
          ? "zítra"
          : plain.toLocaleString("cs-CZ", { weekday: "short" }),
      chipDate: plain.toLocaleString("cs-CZ", {
        day: "numeric",
        month: "numeric",
      }),
      title: formatDayOn(date),
      items: items.map((i) => ({
        productId: i.productId,
        remaining: i.remaining,
        state: !i.baked ? "not_baked" : i.remaining === 0 ? "sold_out" : "open",
        note: !i.baked
          ? `Peče se ${bakedOn.get(i.productId)}`
          : i.remaining === 0
            ? null
            : i.remaining <= FEW_LEFT
              ? piecesLeft(i.remaining)
              : null,
      })),
    };
  });

  return (
    <OrderForm
      cutoff={cutoff.slice(0, 5)}
      products={formProducts}
      days={formDays}
      idempotencyKey={randomUUID()}
      yourOrders={yourOrders}
    />
  );
}
