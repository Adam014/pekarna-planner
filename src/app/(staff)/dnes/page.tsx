import type { Metadata } from "next";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/today/auto-refresh";
import { DayList } from "@/components/today/day-list";
import { DayNav } from "@/components/today/day-nav";
import { db } from "@/lib/db";
import { pickDay } from "@/lib/day-param";
import { addDays, today } from "@/lib/domain/time";
import { formatPhone } from "@/lib/domain/phone";
import { formatDay, formatPrice } from "@/lib/format";
import { dayReservations } from "@/lib/services/reservations.service";
import { fillStandingOrderDays } from "@/lib/services/standing-orders.service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dnes" };

// The page stays synchronous: the day from the URL and the session are read
// inside the Suspense boundary (Cache Components).
export default function TodayPage({ searchParams }: PageProps<"/dnes">) {
  return (
    // `group` lets the list dim while DayNav loads another day.
    // Bottom padding keeps the last row clear of the undo toast on phones.
    <main className="group flex flex-col gap-6 pb-28">
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        {searchParams.then(({ den }) => (
          <Day den={den} />
        ))}
      </Suspense>
    </main>
  );
}

async function Day({ den }: { den: string | string[] | undefined }) {
  await requireUser();
  const now = Temporal.Now.instant();
  const todayDate = today(now);
  const { date, min, max } = pickDay(den, todayDate, todayDate);

  // Standing order days the daily job may have missed (ADR 0007).
  await fillStandingOrderDays(db, now);
  const reservations = await dayReservations(db, date);

  return (
    <>
      <DayNav
        path="/dnes"
        date={date}
        title={formatDay(date)}
        badge={date === todayDate ? "dnes" : undefined}
        isDefault={date === todayDate}
        defaultLabel="Dnes"
        previous={addDays(date, -1)}
        next={addDays(date, 1)}
        min={min}
        max={max}
      />
      <DayList
        key={date}
        isFuture={date > todayDate}
        reservations={reservations.map((r) => ({
          ...r,
          phoneDisplay: formatPhone(r.customerPhone),
          totalDisplay: formatPrice(r.total),
        }))}
      />
      <AutoRefresh />
    </>
  );
}
