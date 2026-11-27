import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Fragment } from "react";
import { formatBakeDays } from "@/components/products/messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EMPTY_TEXT, EMPTY_TITLE, formatTime } from "./messages";
import {
  type FormContext,
  StandingOrderDialog,
  type StandingOrderView,
} from "./standing-order-dialog";

/** The button that opens an empty standing order form. */
export function AddStandingOrderButton({ context }: { context: FormContext }) {
  return (
    <StandingOrderDialog
      context={context}
      trigger={
        <Button className="bg-crust text-crust-foreground hover:bg-crust/90">
          <PlusIcon aria-hidden />
          Přidat trvalou objednávku
        </Button>
      }
    />
  );
}

/** Every standing order as one row; tapping a row opens it. */
export function StandingOrderList({
  orders,
  context,
}: {
  orders: StandingOrderView[];
  context: FormContext;
}) {
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="font-medium">{EMPTY_TITLE}</p>
        <p className="max-w-md text-muted-foreground">{EMPTY_TEXT}</p>
      </div>
    );
  }
  return (
    <ul
      aria-label="Trvalé objednávky"
      className="divide-y overflow-hidden rounded-xl border bg-card"
    >
      {orders.map((order) => (
        <li key={order.id}>
          <StandingOrderDialog
            order={order}
            context={context}
            trigger={
              <button
                type="button"
                className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "font-medium",
                        !order.active && "text-muted-foreground",
                      )}
                    >
                      {order.customerName}
                    </span>
                    {!order.active && (
                      <Badge variant="secondary">Ukončená</Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {/* A narrow row breaks between the values, not inside one. */}
                    {[
                      formatBakeDays(order.weekdays),
                      ...(order.pickupTime
                        ? [formatTime(order.pickupTime)]
                        : []),
                    ].map((value) => (
                      <Fragment key={value}>
                        <span className="whitespace-nowrap">{value}</span>
                        {" · "}
                      </Fragment>
                    ))}
                    {order.items.map((item, i) => (
                      <Fragment key={item.productId}>
                        {i > 0 && ", "}
                        <span className="whitespace-nowrap">
                          {item.productName} {item.quantity} ks
                        </span>
                      </Fragment>
                    ))}
                  </span>
                  {order.warnings.map((warning) => (
                    <span
                      key={warning}
                      className="text-sm text-warning-foreground"
                    >
                      <TriangleAlertIcon
                        aria-hidden
                        className="mr-1.5 inline size-4 align-[-0.125em]"
                      />
                      {warning}
                    </span>
                  ))}
                </span>
                <span
                  aria-hidden
                  className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:inline"
                >
                  {order.active ? "Upravit" : "Zobrazit"}
                </span>
              </button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
