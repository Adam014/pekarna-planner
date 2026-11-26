"use client";

import { MoreHorizontalIcon } from "lucide-react";
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { setStatus } from "@/app/(staff)/dnes/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type {
  ReservationSource,
  ReservationStatus,
} from "@/lib/domain/reservation";
import { matchesCustomer } from "@/lib/search";
import type { DayReservation } from "@/lib/services/reservations.service";
import { changedMessage, refusalMessage, STATUS_LABEL } from "./messages";

export type DayRow = DayReservation & {
  phoneDisplay: string;
  totalDisplay: string;
};

const STATUS_VARIANT: Record<
  ReservationStatus,
  "info" | "success" | "warning" | "secondary"
> = {
  reserved: "info",
  picked_up: "success",
  no_show: "warning",
  cancelled: "secondary",
};

const SOURCE: Record<ReservationSource, string> = {
  phone: "Telefon",
  online: "Online",
  standing_order: "Trvalá",
};

/**
 * The day's reservations: "K výdeji" first, then the handled ones. A mark
 * shows at once and is undone from the row ("Vrátit") or the toast ("Zpět");
 * the server decides, and a refused mark goes back on its own.
 */
export function DayList({
  reservations,
  isFuture,
}: {
  reservations: DayRow[];
  isFuture: boolean;
}) {
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  // The undo toast belongs to this day's list; leaving it closes the toast.
  useEffect(() => () => void toast.dismiss("status"), []);
  const [rows, setOptimistic] = useOptimistic(
    reservations,
    (list, change: { id: string; status: ReservationStatus }) =>
      list.map((r) =>
        r.id === change.id ? { ...r, status: change.status } : r,
      ),
  );

  // Actions are disabled while a change is saving, so a second quick tap
  // cannot land on the next row that slid under the finger.
  function change(row: DayRow, to: ReservationStatus) {
    const from = row.status;
    startTransition(async () => {
      setOptimistic({ id: row.id, status: to });
      const result = await setStatus({
        reservationId: row.id,
        from,
        status: to,
      });
      // The used button moved to the other section; keep focus in the list.
      if (document.activeElement === document.body) listRef.current?.focus();
      const message = refusalMessage(result);
      if (message) {
        // A new toast, so it cannot inherit the last change's "Zpět".
        toast.dismiss("status");
        toast.error(message, { id: "status-error" });
        return;
      }
      toast.dismiss("status-error");
      // One toast for the last change; it stays until closed or replaced,
      // and the row's "Vrátit" undoes it too (WCAG 2.2.1).
      toast.success(changedMessage(row.customerName, to), {
        id: "status",
        duration: Number.POSITIVE_INFINITY,
        cancel: { label: "Zavřít", onClick: () => toast.dismiss("status") },
        action: {
          label: "Zpět",
          onClick: () => change({ ...row, status: to }, from),
        },
      });
    });
  }

  if (reservations.length === 0) {
    return (
      <p className="text-muted-foreground group-has-data-pending:opacity-50">
        Na tento den nejsou žádné objednávky.
      </p>
    );
  }

  const shown = rows.filter((r) =>
    matchesCustomer({ name: r.customerName, phone: r.customerPhone }, query),
  );
  const waiting = shown.filter((r) => r.status === "reserved");
  const handled = shown.filter((r) => r.status !== "reserved");

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className="flex flex-col gap-6 outline-none transition-opacity group-has-data-pending:opacity-50"
    >
      <div data-print="hide">
        <label className="sr-only" htmlFor="day-search">
          Hledat jméno nebo telefon
        </label>
        <Input
          id="day-search"
          type="search"
          placeholder="Hledat jméno nebo telefon"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-sm"
        />
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">Hledání nic nenašlo.</p>
      ) : (
        <>
          <Section title="K výdeji" rows={waiting}>
            {(row) => (
              <WaitingActions
                row={row}
                isFuture={isFuture}
                disabled={isPending}
                change={change}
              />
            )}
          </Section>
          <Section title="Vyřízené" rows={handled}>
            {(row) => (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => change(row, "reserved")}
              >
                Vrátit
              </Button>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  children,
}: {
  title: string;
  rows: DayRow[];
  children: (row: DayRow) => React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="text-lg font-semibold">
        {title}{" "}
        <span className="text-muted-foreground tabular-nums">
          ({rows.length})
        </span>
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <Row key={row.id} row={row}>
            {children(row)}
          </Row>
        ))}
      </ul>
    </section>
  );
}

function Row({ row, children }: { row: DayRow; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start sm:gap-4">
      <div className="w-14 shrink-0 font-semibold tabular-nums">
        {row.pickupTime ?? (
          <span className="text-muted-foreground">kdykoli</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.customerName}</span>
          <Badge variant={STATUS_VARIANT[row.status]}>
            {STATUS_LABEL[row.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {SOURCE[row.source]}
          </span>
        </div>
        <a
          href={`tel:${row.customerPhone}`}
          className="inline-flex min-h-11 w-fit items-center text-sm text-muted-foreground tabular-nums underline-offset-4 hover:underline"
        >
          {row.phoneDisplay}
        </a>
        <ul className="text-sm">
          {row.items.map((item) => (
            <li key={item.productName}>
              <span className="tabular-nums">{item.quantity}×</span>{" "}
              {item.productName}
            </li>
          ))}
        </ul>
        {row.note && <p className="text-sm">Poznámka: {row.note}</p>}
        <p className="text-sm font-medium tabular-nums">{row.totalDisplay}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2" data-print="hide">
        {children}
      </div>
    </li>
  );
}

function WaitingActions({
  row,
  isFuture,
  disabled,
  change,
}: {
  row: DayRow;
  isFuture: boolean;
  disabled: boolean;
  change: (row: DayRow, to: ReservationStatus) => void;
}) {
  // A future order can only be cancelled (canSetStatus).
  if (isFuture) {
    return (
      <Button
        variant="outline"
        disabled={disabled}
        onClick={() => change(row, "cancelled")}
      >
        Zrušit
      </Button>
    );
  }
  return (
    <>
      <Button disabled={disabled} onClick={() => change(row, "picked_up")}>
        Vydáno
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={`Další akce: ${row.customerName}`}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem onSelect={() => change(row, "no_show")}>
            Nevyzvednuto
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => change(row, "cancelled")}
          >
            Zrušit objednávku
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
