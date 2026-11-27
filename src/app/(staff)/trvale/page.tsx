import type { Metadata } from "next";
import { Suspense } from "react";
import {
  appliesFromMessage,
  formatDayFrom,
  inactiveRowMessage,
  skippedDays,
  skippedSummary,
} from "@/components/standing-orders/messages";
import {
  AddStandingOrderButton,
  StandingOrderList,
} from "@/components/standing-orders/standing-order-list";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/domain/phone";
import { firstOpenDay } from "@/lib/domain/standing-orders";
import { addDays, today, weekdayOf } from "@/lib/domain/time";
import { listCustomers } from "@/lib/services/customers";
import { listProducts } from "@/lib/services/products.service";
import { cutoffTime } from "@/lib/services/settings";
import {
  fillStandingOrderDays,
  listStandingOrders,
} from "@/lib/services/standing-orders.service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Trvalé objednávky" };

const TITLE = (
  <h1 className="text-2xl font-semibold tracking-tight">Trvalé objednávky</h1>
);

// "Trvalé objednávky" (R7): the owner keeps the regular customers' weekly
// orders. The session is read inside the Suspense boundary (Cache
// Components).
export default function StandingOrdersPage() {
  return (
    <main className="flex flex-col gap-6">
      <Suspense
        fallback={
          <>
            <div className="flex min-h-11 items-center">{TITLE}</div>
            <p className="text-muted-foreground">Načítám…</p>
          </>
        }
      >
        <StandingOrders />
      </Suspense>
    </main>
  );
}

async function StandingOrders() {
  await requireUser("owner");
  const now = Temporal.Now.instant();
  // Standing order days the daily job may have missed (ADR 0007); the days
  // that do not fit the limit show on their rows.
  const { skipped } = await fillStandingOrderDays(db, now);
  const [orders, products, customers, cutoff] = await Promise.all([
    listStandingOrders(db),
    listProducts(db),
    listCustomers(db),
    cutoffTime(db),
  ]);

  const tomorrow = addDays(today(now), 1);
  const from = firstOpenDay(now, cutoff);
  const context = {
    products: products
      .filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.name, bakeDays: p.bakeDays })),
    customers: customers.map((c) => ({
      ...c,
      phoneDisplay: formatPhone(c.phone),
    })),
    appliesFrom: appliesFromMessage(from),
    endFrom: formatDayFrom(from),
    closedTomorrowWeekday: from > tomorrow ? weekdayOf(tomorrow) : null,
  };

  const views = orders.map((order) => {
    const days = skippedDays(
      skipped.filter((s) => s.standingOrderId === order.id),
    );
    const inactive = order.items
      .filter((i) => !i.productActive)
      .map((i) => i.productName);
    return {
      ...order,
      phoneDisplay: formatPhone(order.phone),
      // An ended order makes no days, so nothing to warn about.
      warnings: order.active
        ? [
            ...(days.length > 0 ? [skippedSummary(days)] : []),
            ...(inactive.length > 0 ? [inactiveRowMessage(inactive)] : []),
          ]
        : [],
    };
  });

  return (
    <>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        {TITLE}
        <AddStandingOrderButton context={context} />
      </div>
      <StandingOrderList orders={views} context={context} />
    </>
  );
}
