"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MAX_QUANTITY = 999;

/**
 * A number field with − and + (APG spinbutton, NN/g steppers): the field is
 * the only tab stop and takes typing and Up/Down; the buttons are for touch.
 */
export function QuantityStepper({
  id,
  label,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  /** The product, for the buttons' names ("Přidat Rohlík"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const set = (next: number) =>
    onChange(Math.min(MAX_QUANTITY, Math.max(0, next)));

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        tabIndex={-1}
        aria-label={`Ubrat ${label}`}
        disabled={value === 0}
        onClick={() => set(value - 1)}
      >
        <MinusIcon />
      </Button>
      <input
        id={id}
        role="spinbutton"
        inputMode="numeric"
        autoComplete="off"
        aria-label={`${label}, počet kusů`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={MAX_QUANTITY}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        maxLength={3}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")))}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            e.preventDefault();
            set(value + 1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            set(value - 1);
          }
        }}
        className={cn(
          "h-11 w-14 rounded-lg border border-input bg-transparent text-center text-base font-medium tabular-nums outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30",
        )}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        tabIndex={-1}
        aria-label={`Přidat ${label}`}
        onClick={() => set(value + 1)}
      >
        <PlusIcon />
      </Button>
    </div>
  );
}
