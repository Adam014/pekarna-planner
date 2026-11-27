import type { Metadata } from "next";
import { Suspense } from "react";
import { WEEKDAY_SHORT } from "@/components/new-reservation/messages";
import { NewReservationForm } from "@/components/new-reservation/new-reservation-form";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/domain/phone";
import { formatPrice } from "@/lib/format";
import { listCustomers } from "@/lib/services/customers";
import { phoneOrderForm } from "@/lib/services/reservations.service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Nová rezervace" };

// "Nová rezervace" (R1): staff record an order taken on the phone. The
// session is read inside the Suspense boundary (Cache Components).
export default function NewReservationPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Nová rezervace</h1>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  await requireUser();
  const now = Temporal.Now.instant();
  const [form, customers] = await Promise.all([
    phoneOrderForm(db, now),
    listCustomers(db),
  ]);

  // Day labels are made here: the browser's Temporal support does not matter.
  const days = form.dates.map((date, i) => {
    const day = Temporal.PlainDate.from(date);
    const weekday = WEEKDAY_SHORT[day.dayOfWeek - 1];
    return {
      date,
      weekday: day.dayOfWeek,
      pill: i === 0 ? "Dnes" : i === 1 ? "Zítra" : `${weekday} ${day.day}.`,
      short: `${weekday} ${day.day}. ${day.month}.`,
      long: day.toLocaleString("cs-CZ", {
        weekday: "long",
        day: "numeric",
        month: "numeric",
      }),
    };
  });

  return (
    <NewReservationForm
      products={form.products.map((p) => ({
        ...p,
        priceDisplay: formatPrice(p.price),
      }))}
      days={days}
      remaining={form.remaining}
      customers={customers.map((c) => ({
        ...c,
        phoneDisplay: formatPhone(c.phone),
      }))}
    />
  );
}
