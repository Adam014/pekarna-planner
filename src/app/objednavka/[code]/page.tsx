import { ChevronDownIcon } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { cancelOrder } from "@/app/actions";
import { CancelButton } from "@/components/order/cancel-button";
import { LinkPageHeader, NewOrderButton } from "@/components/order/link-page";
import { OrderItems } from "@/components/order/order-items";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";
import {
  formatDay,
  formatDayOn,
  formatDeadline,
  formatPrice,
} from "@/lib/format";
import { orderByToken } from "@/lib/services/reservations.service";
import { cn } from "@/lib/utils";
import { orderToken } from "@/lib/validators/order-token";

// The headers in next.config.ts add no-referrer and noindex for this path.
export const metadata: Metadata = {
  title: "Vaše objednávka",
  robots: { index: false, follow: false },
};

// The customer's order behind their link (R3). The page stays synchronous:
// the header is the static shell; the token is runtime data, so the order
// renders per request inside Suspense (Cache Components).
export default function OrderLinkPage({
  params,
}: PageProps<"/objednavka/[code]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-7 pb-6 sm:pt-13">
      <LinkPageHeader title="Vaše objednávka" />
      <Suspense
        fallback={<p className="text-muted-foreground">Načítám objednávku…</p>}
      >
        {params.then(({ code }) => (
          <OrderDetails code={code} />
        ))}
      </Suspense>
    </main>
  );
}

async function OrderDetails({ code }: { code: string }) {
  // Unknown, expired and malformed links get the same answer (OWASP).
  const token = orderToken.safeParse(code);
  if (!token.success) notFound();
  // The time and the order are per request, also in a runtime prefetch.
  await io();
  const order = await orderByToken(db, token.data, Temporal.Now.instant());
  if (!order) notFound();

  const day = formatDay(order.pickupDate);
  const deadline = formatDeadline(Temporal.Instant.from(order.deadline));

  return (
    <>
      <section className="flex flex-col gap-6" aria-label="Objednávka">
        <div className="flex flex-col items-start gap-2">
          <StatusBadge status={order.status} />
          <div>
            <p className="text-lg font-medium">Vyzvednutí: {day}</p>
            {order.pickupTime && (
              <p className="text-muted-foreground">
                kolem {order.pickupTime.replace(/^0/, "")}
              </p>
            )}
          </div>
        </div>

        <OrderItems
          items={order.items.map((i) => ({
            name: i.productName,
            quantity: i.quantity,
            price: formatPrice(i.quantity * i.unitPrice),
          }))}
          total={formatPrice(order.total)}
        />

        {/* One live region, so the result of cancelling is announced. */}
        <div role="status">
          {order.cancellable ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground">
                Zrušit můžete do uzávěrky: {deadline}.
              </p>
              {/* Native disclosure as the confirmation step: no script, no
                dialog; the destructive button only shows once opened. */}
              <details className="group flex flex-col">
                <summary
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "w-fit list-none [&::-webkit-details-marker]:hidden",
                  )}
                >
                  Zrušit objednávku
                  <ChevronDownIcon
                    aria-hidden
                    className="transition-transform group-open:rotate-180"
                  />
                </summary>
                <form
                  action={cancelOrder}
                  className="mt-3 flex flex-col items-start gap-4 rounded-xl border bg-card p-4"
                >
                  <p>
                    Zrušit objednávku na {formatDayOn(order.pickupDate)}? Pečivo
                    pak může objednat někdo jiný a zrušení nejde vrátit.
                  </p>
                  <input type="hidden" name="token" value={token.data} />
                  <CancelButton />
                </form>
              </details>
            </div>
          ) : order.status === "reserved" ? (
            <p className="text-muted-foreground">
              Na zrušení je už pozdě. Uzávěrka byla: {deadline}.
            </p>
          ) : order.status === "cancelled" ? (
            <p className="text-muted-foreground">Objednávka je zrušená.</p>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          Kdo má tento odkaz, vidí objednávku a může ji do uzávěrky zrušit.
        </p>
      </section>

      <footer className="mt-auto">
        {order.status === "cancelled" ? (
          <NewOrderButton label="Objednat znovu" />
        ) : (
          <NewOrderButton label="Nová objednávka" quiet />
        )}
      </footer>
    </>
  );
}
