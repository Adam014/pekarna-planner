"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useOptimistic } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The shown day with previous / next day, "Dnes" and a date picker. Sets
 * `data-pending` while the next day loads, so the list can dim. The picker
 * navigates only when submitted: while a date is typed, the input passes
 * through dates like 0002-11-26.
 */
export function DayNav({
  date,
  title,
  isToday,
  previous,
  next,
  min,
  max,
}: {
  date: string;
  title: string;
  isToday: boolean;
  previous: string;
  next: string;
  /** The range "Dnes" can show (dayViewRange). */
  min: string;
  max: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useOptimistic(false);

  function go(href: string) {
    startTransition(() => {
      setIsPending(true);
      router.push(href);
    });
  }

  return (
    <div
      className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      data-pending={isPending ? "" : undefined}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight first-letter:uppercase">
          {title}
        </h1>
        {isToday && <Badge variant="info">dnes</Badge>}
      </div>
      <div className="flex items-center gap-2" data-print="hide">
        <Button
          variant="outline"
          size="icon"
          aria-label="Předchozí den"
          onClick={() => go(`/dnes?den=${previous}`)}
        >
          <ChevronLeftIcon />
        </Button>
        {!isToday && (
          // Without a parameter "/dnes" always means the current day.
          <Button variant="outline" onClick={() => go("/dnes")}>
            Dnes
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label="Další den"
          onClick={() => go(`/dnes?den=${next}`)}
        >
          <ChevronRightIcon />
        </Button>
        <form
          action="/dnes"
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("den");
            if (typeof value === "string" && value) go(`/dnes?den=${value}`);
          }}
        >
          <label className="sr-only" htmlFor="day-picker">
            Vybrat den
          </label>
          <input
            key={date}
            id="day-picker"
            name="den"
            type="date"
            defaultValue={date}
            min={min}
            max={max}
            required
            className="h-11 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm"
          />
          <Button type="submit" variant="outline">
            Zobrazit
          </Button>
        </form>
      </div>
    </div>
  );
}
