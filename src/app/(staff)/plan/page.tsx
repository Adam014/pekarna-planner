import type { Metadata } from "next";
import { Suspense } from "react";
import { PlanNotes } from "@/components/plan/plan-notes";
import { PlanTable } from "@/components/plan/plan-table";
import { PrintButton } from "@/components/plan/print-button";
import { AutoRefresh } from "@/components/today/auto-refresh";
import { DayNav } from "@/components/today/day-nav";
import { db } from "@/lib/db";
import { pickDay } from "@/lib/day-param";
import { addDays, today } from "@/lib/domain/time";
import {
  formatDay,
  formatDayWithYear,
  formatDeadline,
  formatStamp,
} from "@/lib/format";
import { dayPlan } from "@/lib/services/bake-plan.service";
import { fillStandingOrderDays } from "@/lib/services/standing-orders.service";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Plán pečení" };

// "Plán pečení" (R4): tomorrow by default, printed for the baker on one A4.
export default function PlanPage({ searchParams }: PageProps<"/plan">) {
  return (
    <main className="group flex flex-col gap-6 print:gap-4">
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        {searchParams.then(({ den }) => (
          <Plan den={den} />
        ))}
      </Suspense>
    </main>
  );
}

async function Plan({ den }: { den: string | string[] | undefined }) {
  await requireUser();
  const now = Temporal.Now.instant();
  const todayDate = today(now);
  const tomorrow = addDays(todayDate, 1);
  const { date, min, max } = pickDay(den, todayDate, tomorrow);

  // Standing order days the daily job may have missed (ADR 0007).
  await fillStandingOrderDays(db, now);
  const plan = await dayPlan(db, date);
  const open = Temporal.Instant.compare(now, plan.deadline) < 0;
  const deadline = formatDeadline(plan.deadline);

  return (
    <>
      <div data-print="hide">
        <DayNav
          path="/plan"
          date={date}
          title={formatDay(date)}
          badge={
            date === todayDate
              ? "dnes"
              : date === tomorrow
                ? "zítra"
                : undefined
          }
          isDefault={date === tomorrow}
          defaultLabel="Zítra"
          previous={addDays(date, -1)}
          next={addDays(date, 1)}
          min={min}
          max={max}
        />
      </div>

      <div
        data-print="hide"
        className="flex flex-col gap-3 transition-opacity group-has-data-pending:opacity-50 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className={open ? "font-medium" : "text-muted-foreground"}>
          {open
            ? `Předběžné – online objednávky běží do: ${deadline}.`
            : date >= todayDate
              ? `Online objednávky uzavřeny: ${deadline}. Telefonické se mohou ještě přidat.`
              : `Online objednávky uzavřeny: ${deadline}.`}
        </p>
        <PrintButton />
      </div>

      <div className="flex flex-col gap-8 transition-opacity group-has-data-pending:opacity-50">
        <PlanTable
          rows={plan.rows}
          dateLabel={formatDayWithYear(date)}
          stamp={formatStamp(now)}
          preliminary={open}
        />
        <PlanNotes notes={plan.notes} />
      </div>
      <AutoRefresh />
    </>
  );
}
