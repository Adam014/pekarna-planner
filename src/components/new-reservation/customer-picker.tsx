"use client";

import { PlusIcon } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { matchesCustomer } from "@/lib/search";
import { cn } from "@/lib/utils";

export type CustomerOption = {
  name: string;
  /** E.164. */
  phone: string;
  phoneDisplay: string;
};

const MAX_SUGGESTIONS = 5;

/**
 * One search for an existing customer by phone or name, with "Nový zákazník"
 * always last (Toast, Resy). A combobox as in the WAI-ARIA APG: focus stays
 * in the field, Up/Down move, Enter picks, Escape closes.
 */
export function CustomerPicker({
  id,
  customers,
  onPick,
  onNew,
  invalid,
  describedBy,
}: {
  id: string;
  customers: CustomerOption[];
  onPick: (customer: CustomerOption) => void;
  /** Starts a new customer with what was typed. */
  onNew: (query: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = query.trim()
    ? customers
        .filter((c) => matchesCustomer(c, query))
        .slice(0, MAX_SUGGESTIONS)
    : [];
  // The matches, then "Nový zákazník".
  const count = matches.length + 1;
  const expanded = open && query.trim() !== "";
  const optionId = (i: number) => `${listId}-${i}`;

  function choose(i: number) {
    const match = matches[i];
    if (match) onPick(match);
    else onNew(query);
  }

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(active) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        // Someone else's number: the browser's own suggestions do not apply.
        autoComplete="off"
        autoFocus
        placeholder="Telefon nebo jméno"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (expanded) setActive((active + 1) % count);
            setOpen(true);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (expanded) setActive((active - 1 + count) % count);
            setOpen(true);
          } else if (e.key === "Enter" && expanded) {
            e.preventDefault();
            choose(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Zákazníci"
        hidden={!expanded}
        className="mt-2 divide-y overflow-hidden rounded-xl border bg-card"
      >
        {[...matches, null].map((c, i) => (
          <li
            key={c?.phone ?? "new"}
            id={optionId(i)}
            role="option"
            aria-selected={i === active}
            // Keeps focus in the field (APG).
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(i)}
            onMouseMove={() => setActive(i)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2",
              i === active && "bg-accent",
            )}
          >
            {c ? (
              <>
                <span className="truncate font-medium">{c.name}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {c.phoneDisplay}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-2 font-medium">
                <PlusIcon aria-hidden className="size-4" />
                Nový zákazník
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
