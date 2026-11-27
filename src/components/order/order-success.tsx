"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OrderSummary } from "@/app/actions";
import { Button } from "@/components/ui/button";

const noSubscribe = () => () => {};

/**
 * Shown in place of the form after a saved order: what was ordered and the
 * order link to keep. The link's page comes with R3; until then the link is
 * only shown and copied.
 */
export function OrderSuccess({
  orderPath,
  summary,
}: {
  orderPath: string;
  summary: OrderSummary;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  // The full address needs the browser's origin; the server shows the path.
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => "",
  );
  const url = `${origin}${orderPath}`;
  const linkRef = useRef<HTMLParagraphElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access: select the link so it can be copied by hand.
      const node = linkRef.current;
      if (!node) return;
      window.getSelection()?.selectAllChildren(node);
    }
  }

  return (
    <div role="status" className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight outline-none"
        >
          Objednávka přijata
        </h2>
        <p className="text-muted-foreground first-letter:uppercase">
          Vyzvednutí: {summary.day}
        </p>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {summary.items.map((item) => (
          <li
            key={item.name}
            className="flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <span>
              <span className="font-medium tabular-nums">{item.quantity}×</span>{" "}
              {item.name}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {item.price}
            </span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-4 bg-muted/50 px-4 py-3 font-semibold">
          <span>
            Celkem{" "}
            <span className="font-normal text-muted-foreground">
              (platí se v pekárně)
            </span>
          </span>
          <span className="tabular-nums">{summary.total}</span>
        </li>
      </ul>

      <div className="flex flex-col gap-3">
        <h3 className="font-semibold">Odkaz na objednávku</h3>
        <p
          ref={linkRef}
          className="rounded-lg border bg-muted/50 px-3 py-2.5 font-mono text-sm break-all select-all"
        >
          {url}
        </p>
        <p className="text-muted-foreground">
          Uložte si ho. Přes něj objednávku zkontrolujete a do uzávěrky zrušíte.
        </p>
        {/* A plain GET of "/" loads a new form with a new order key, also
            without JavaScript; a client navigation would keep this state. */}
        <form method="get" action="/" className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={copy}
            className="bg-crust text-crust-foreground hover:bg-crust/85"
          >
            {copied ? "Odkaz zkopírován" : "Kopírovat odkaz"}
          </Button>
          <Button type="submit" variant="outline" size="lg">
            Nová objednávka
          </Button>
        </form>
      </div>
    </div>
  );
}
