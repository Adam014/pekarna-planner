"use client";

import { MoreHorizontalIcon, SearchIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";
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

type View = "waiting" | "handled";

/**
 * The day's reservations, one view at a time: "K výdeji" (the work left) or
 * "Vyřízené". A mark shows at once and is undone from the row ("Vrátit") or
 * the toast ("Zpět"); the server decides, and a refused mark goes back on
 * its own.
 */
export function DayList({
  reservations,
  isFuture,
}: {
  reservations: DayRow[];
  isFuture: boolean;
}) {
  const [view, setView] = useState<View>("waiting");
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
      // The used row left the view; keep focus in the list.
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
      <p className="py-12 text-center text-muted-foreground transition-opacity group-has-data-pending:opacity-50">
        Na tento den nejsou žádné objednávky.
      </p>
    );
  }

  const waiting = rows.filter((r) => r.status === "reserved");
  const handled = rows.filter((r) => r.status !== "reserved");
  const shown = (view === "waiting" ? waiting : handled).filter((r) =>
    matchesCustomer({ name: r.customerName, phone: r.customerPhone }, query),
  );

  return (
    <div
      ref={listRef}
      tabIndex={-1}
      className="flex flex-col gap-4 outline-none transition-opacity group-has-data-pending:opacity-50"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Zobrazit"
          className="inline-flex w-fit rounded-lg bg-muted p-1"
        >
          <ViewButton
            active={view === "waiting"}
            onClick={() => setView("waiting")}
            label="K výdeji"
            count={waiting.length}
          />
          <ViewButton
            active={view === "handled"}
            onClick={() => setView("handled")}
            label="Vyřízené"
            count={handled.length}
          />
        </div>
        <div className="relative sm:w-72">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Hledat jméno nebo telefon"
            placeholder="Jméno nebo telefon"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {shown.length > 0 ? (
        <ul
          aria-label={view === "waiting" ? "K výdeji" : "Vyřízené"}
          className="divide-y overflow-hidden rounded-xl border bg-card"
        >
          {shown.map((row) => (
            <Row key={row.id} row={row} showStatus={view === "handled"}>
              {view === "waiting" ? (
                <WaitingActions
                  row={row}
                  isFuture={isFuture}
                  disabled={isPending}
                  change={change}
                />
              ) : (
                <Button
                  variant="outline"
                  disabled={isPending}
                  onClick={() => change(row, "reserved")}
                >
                  Vrátit
                </Button>
              )}
            </Row>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          {query
            ? "Hledání nic nenašlo."
            : view === "waiting"
              ? "Vše je vyřízené."
              : "Zatím nic vyřízeného."}
        </p>
      )}
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-11 cursor-pointer items-center gap-2 rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "bg-background text-foreground shadow-sm",
      )}
    >
      {label}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function Row({
  row,
  showStatus,
  children,
}: {
  row: DayRow;
  showStatus: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr] gap-x-4 gap-y-2 p-4 sm:grid-cols-[3.5rem_minmax(0,14rem)_1fr_auto_auto] sm:items-center">
      <span className="font-semibold tabular-nums">
        {row.pickupTime ?? (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{row.customerName}</span>
          {showStatus && (
            <Badge variant={STATUS_VARIANT[row.status]}>
              {STATUS_LABEL[row.status]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <a
            href={`tel:${row.customerPhone}`}
            className="inline-flex min-h-11 items-center tabular-nums underline-offset-4 hover:underline"
          >
            {row.phoneDisplay}
          </a>
          <span aria-hidden>·</span>
          <span>{SOURCE[row.source]}</span>
        </div>
      </div>

      <div className="col-start-2 min-w-0 sm:col-start-auto">
        <p>
          {row.items.map((item, i) => (
            <span key={item.productName} className="whitespace-nowrap">
              {i > 0 && <span className="text-muted-foreground"> · </span>}
              <span className="font-medium tabular-nums">
                {item.quantity}×
              </span>{" "}
              {item.productName}
            </span>
          ))}
        </p>
        {row.note && (
          <p className="mt-1 text-sm text-muted-foreground">„{row.note}“</p>
        )}
      </div>

      <span className="col-start-2 text-sm tabular-nums text-muted-foreground sm:col-start-auto sm:text-right">
        {row.totalDisplay}
      </span>

      <div className="col-start-2 flex items-center gap-2 sm:col-start-auto sm:justify-end">
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
            variant="ghost"
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
