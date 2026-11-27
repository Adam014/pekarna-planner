import { PlusIcon } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import type { ProductRow } from "@/lib/services/products.service";
import { cn } from "@/lib/utils";
import { formatBakeDays } from "./messages";
import { ProductDialog } from "./product-dialog";

/** The button that opens an empty product form. */
export function AddProductButton() {
  return (
    <ProductDialog
      trigger={
        <Button className="bg-crust text-crust-foreground hover:bg-crust/90">
          <PlusIcon aria-hidden />
          Přidat výrobek
        </Button>
      }
    />
  );
}

/** Every product as one row; tapping a row opens it for editing. */
export function ProductList({ products }: { products: ProductRow[] }) {
  if (products.length === 0) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Zatím tu nejsou žádné výrobky.
      </p>
    );
  }
  return (
    <ul
      aria-label="Výrobky"
      className="divide-y overflow-hidden rounded-xl border bg-card"
    >
      {products.map((p) => (
        <li key={p.id}>
          <ProductDialog
            product={p}
            trigger={
              <button
                type="button"
                className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={cn(
                        "font-medium",
                        !p.active && "text-muted-foreground",
                      )}
                    >
                      {p.name}
                    </span>
                    {!p.active && (
                      <Badge variant="secondary">Mimo nabídku</Badge>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {/* A narrow row breaks between the values, not inside one. */}
                    {[
                      formatPrice(p.price),
                      `limit ${p.dailyLimit} ks`,
                      `rezerva ${p.buffer} ks`,
                      formatBakeDays(p.bakeDays),
                    ].map((value, i) => (
                      <Fragment key={value}>
                        {i > 0 && " · "}
                        <span className="whitespace-nowrap">{value}</span>
                      </Fragment>
                    ))}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:inline"
                >
                  Upravit
                </span>
              </button>
            }
          />
        </li>
      ))}
    </ul>
  );
}
