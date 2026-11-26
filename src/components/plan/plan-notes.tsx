import type { PlanNote } from "@/lib/services/bake-plan.service";

/** Notes of the day's orders, on screen only: the printed sheet is just what to bake. */
export function PlanNotes({ notes }: { notes: PlanNote[] }) {
  return (
    <div className="flex flex-col gap-6 print:hidden">
      {notes.length > 0 && (
        <section aria-labelledby="plan-notes" className="flex flex-col gap-2">
          <h2
            id="plan-notes"
            className="text-lg font-semibold print:text-[13pt]"
          >
            Poznámky k objednávkám
          </h2>
          <ul className="flex flex-col gap-1.5">
            {notes.map((n) => (
              <li
                key={`${n.pickupTime}-${n.customerName}-${n.note}`}
                className="flex gap-3"
              >
                <span className="w-16 shrink-0 font-medium tabular-nums">
                  {n.pickupTime ?? "kdykoli"}
                </span>
                <span>
                  <span className="font-medium">{n.customerName}:</span>{" "}
                  {n.note}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
