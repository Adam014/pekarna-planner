import { planTotals, type PlanRow } from "@/lib/domain/bake-plan";
import { cn } from "@/lib/utils";

const number = "px-3 py-3 text-right tabular-nums";
// The breakdown is on screens from tablet width up. A phone shows it as a
// second line, and the printed sheet leaves it out: the baker only needs
// how many to bake.
const breakdown = "hidden sm:table-cell print:hidden";

/**
 * What to bake, one row per product. "Upéct" is the only large number, so the
 * baker reads it first (research: docs/research/reports). Printed, it is a
 * plain checklist: the day on top of every page, then product and number.
 */
export function PlanTable({
  rows,
  dateLabel,
  stamp,
  preliminary,
}: {
  rows: PlanRow[];
  /** "pátek 27. listopadu 2026", on top of every printed page. */
  dateLabel: string;
  /** When the numbers were read, e.g. "26. 11. 2026 5:12". */
  stamp: string;
  /** Online orders are still open, so the numbers can still grow. */
  preliminary: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground">
        Na tento den se nic nepeče a nikdo nic neobjednal.
      </p>
    );
  }
  const totals = planTotals(rows);
  return (
    <div className="overflow-hidden rounded-lg border bg-card print:overflow-visible print:rounded-none print:border-0 print:bg-transparent">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Kolik upéct: objednávky, trvalé objednávky a rezerva pro pult
        </caption>
        <thead>
          {/* The printed header; in <thead>, so every page repeats it. */}
          <tr className="hidden print:table-row">
            <th colSpan={3} className="pb-[8mm] text-left font-normal">
              <div className="flex items-baseline justify-between text-[11pt] tracking-wide text-black/55 uppercase">
                <span>Plán pečení</span>
                <span className="normal-case tracking-normal">
                  Stav k {stamp}
                </span>
              </div>
              <div className="mt-[2mm] text-[24pt] leading-tight font-semibold tracking-tight text-black first-letter:uppercase">
                {dateLabel}
              </div>
              {preliminary && (
                <div className="mt-[1mm] text-[11pt] text-black/70">
                  Předběžné – online objednávky ještě běží.
                </div>
              )}
            </th>
          </tr>
          <tr className="border-b bg-muted/50 text-left text-sm text-muted-foreground print:hidden">
            <th scope="col" className="px-3 py-2.5 font-medium">
              Produkt
            </th>
            <th
              scope="col"
              className={cn(number, breakdown, "py-2.5 font-medium")}
            >
              Objednávky
            </th>
            <th
              scope="col"
              className={cn(number, breakdown, "py-2.5 font-medium")}
            >
              Trvalé
            </th>
            <th
              scope="col"
              className={cn(number, breakdown, "py-2.5 font-medium")}
            >
              Rezerva
            </th>
            <th
              scope="col"
              className={cn(number, "py-2.5 font-semibold text-foreground")}
            >
              Upéct
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.productId}
              className="border-b print:break-inside-avoid print:border-black/15"
            >
              {/* A box the baker ticks with a pen. */}
              <td className="hidden w-[10mm] print:table-cell">
                <span className="block size-[5mm] rounded-[1mm] border-[1.5px] border-black/70" />
              </td>
              <th
                scope="row"
                className="px-3 py-3 text-left font-medium print:px-0 print:py-[3mm] print:text-[14pt]"
              >
                {row.name}
                {/* The breakdown on a phone, where its columns are hidden. */}
                <span className="block text-sm font-normal text-muted-foreground sm:hidden print:hidden">
                  {row.orders} obj. · {row.standing} trvalé · {row.buffer}{" "}
                  rezerva
                </span>
              </th>
              <td className={cn(number, breakdown, "text-muted-foreground")}>
                {row.orders}
              </td>
              <td className={cn(number, breakdown, "text-muted-foreground")}>
                {row.standing}
              </td>
              <td className={cn(number, breakdown, "text-muted-foreground")}>
                {row.buffer}
              </td>
              <td
                className={cn(
                  number,
                  "text-2xl font-semibold print:px-0 print:text-[20pt] print:leading-none",
                )}
              >
                {row.toBake}
              </td>
            </tr>
          ))}
          {/* In the body, not <tfoot>: a footer repeats on every printed page. */}
          <tr className="border-t-2 bg-muted/50 font-semibold print:break-inside-avoid print:border-t-[1.5px] print:border-black print:bg-transparent">
            <td className="hidden print:table-cell" />
            <th
              scope="row"
              className="px-3 py-3 text-left print:px-0 print:py-[3mm] print:text-[14pt]"
            >
              Celkem
            </th>
            <td className={cn(number, breakdown)}>{totals.orders}</td>
            <td className={cn(number, breakdown)}>{totals.standing}</td>
            <td className={cn(number, breakdown)}>{totals.buffer}</td>
            <td
              className={cn(
                number,
                "text-2xl print:px-0 print:text-[20pt] print:leading-none",
              )}
            >
              {totals.toBake}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
