"use client";

import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The shown day, with previous / next day, a way back to the default day
 * ("Dnes" or "Zítra") and a calendar. Used by "Dnes" and "Plán pečení".
 * Sets `data-pending` while the next day loads, so the page can dim.
 *
 * The calendar is the browser's own picker, opened from the button; its
 * input cannot be typed into, so half-typed dates (0002-11-26) never load.
 */
export function DayNav({
  path,
  date,
  title,
  badge,
  isDefault,
  defaultLabel,
  previous,
  next,
  min,
  max,
}: {
  /** The page; `?den=` picks the day, without it the page shows its default. */
  path: "/dnes" | "/plan";
  date: string;
  title: string;
  /** "dnes" or "zítra" next to the title, when the day is one of those. */
  badge?: string;
  isDefault: boolean;
  defaultLabel: string;
  previous: string;
  next: string;
  /** The range the page can show (pickDay). */
  min: string;
  max: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useOptimistic(false);
  const picker = useRef<HTMLInputElement>(null);

  function go(href: string) {
    startTransition(() => {
      setIsPending(true);
      router.push(href);
    });
  }

  function openPicker() {
    const input = picker.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // Browsers without showPicker() open it on focus or click.
      input.focus();
      input.click();
    }
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3"
      data-pending={isPending ? "" : undefined}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {title}
        </h1>
        {badge && <Badge variant="info">{badge}</Badge>}
      </div>

      <div className="flex items-center gap-2" data-print="hide">
        <div className="flex items-center rounded-lg border bg-card">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Předchozí den"
            className="rounded-r-none"
            onClick={() => go(`${path}?den=${previous}`)}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="ghost"
            disabled={isDefault}
            className="rounded-none border-x px-4 disabled:opacity-100 disabled:text-muted-foreground"
            // Without a parameter the page always shows its default day.
            onClick={() => go(path)}
          >
            {defaultLabel}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Další den"
            className="rounded-l-none"
            onClick={() => go(`${path}?den=${next}`)}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            aria-label="Vybrat den v kalendáři"
            onClick={openPicker}
          >
            <CalendarDaysIcon />
          </Button>
          <input
            ref={picker}
            key={date}
            type="date"
            tabIndex={-1}
            aria-hidden
            defaultValue={date}
            min={min}
            max={max}
            className="pointer-events-none absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (value && value >= min && value <= max && value !== date) {
                go(`${path}?den=${value}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
