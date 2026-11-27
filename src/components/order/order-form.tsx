"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeOrder, type OrderFormState } from "@/app/actions";
import { RollingNumber } from "@/components/rolling-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderErrors, OrderField } from "@/lib/validators/order-form";
import { OrderSuccess } from "./order-success";
import { readContact, writeContact } from "./saved-contact";

export type FormProduct = {
  id: string;
  name: string;
  /** In haléře; the total here is for display, the server prices the order. */
  price: number;
  priceLabel: string;
};

export type FormDay = {
  date: string;
  /** "zítra" or "so" */
  chip: string;
  /** "28. 11." */
  chipDate: string;
  /** "sobotu 28. listopadu", for "Pečivo na …" */
  title: string;
  items: {
    productId: string;
    state: "open" | "sold_out" | "not_baked";
    remaining: number;
    /** "zbývají 3 ks", or for a day it is not baked "Peče se po, st, pá" */
    note: string | null;
  }[];
};

const INITIAL: OrderFormState = { status: "idle" };

/** The first field of each error, for the summary links (GOV.UK). */
const FIELD_ORDER: OrderField[] = [
  "pickupDate",
  "items",
  "pickupTime",
  "customerName",
  "phone",
];

/**
 * The order form on one page (R2): day first, then products, then contact.
 * Validated on the server only, so every message is the same Czech text
 * with or without JavaScript (docs/research/reports/public-order-form).
 */
export function OrderForm({
  intro,
  products,
  days,
  idempotencyKey,
  yourOrders,
}: {
  intro: string;
  products: FormProduct[];
  days: FormDay[];
  /** Made by the server per render, so a double submit saves once. */
  idempotencyKey: string;
  /** "Vaše objednávky" (R3), under the intro; not on the success screen. */
  yourOrders: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(placeOrder, INITIAL);
  const values = state.status === "error" ? state.values : undefined;

  const [date, setDate] = useState(() =>
    days.some((d) => d.date === values?.pickupDate)
      ? (values?.pickupDate ?? "")
      : (days[0]?.date ?? ""),
  );
  const [quantities, setQuantities] = useState<Record<string, string>>(
    () => values?.quantities ?? {},
  );
  const [adjusted, setAdjusted] = useState(false);

  // A field's error disappears once it is edited (Baymard); a new answer
  // from the server brings back what it says.
  const [cleared, setCleared] = useState<OrderField[]>([]);
  const [shownState, setShownState] = useState(state);
  if (shownState !== state) {
    setShownState(state);
    setCleared([]);
  }
  const edited = (field: OrderField) =>
    setCleared((list) => (list.includes(field) ? list : [...list, field]));
  const errors: OrderErrors =
    state.status === "error"
      ? Object.fromEntries(
          Object.entries(state.errors).filter(
            ([field]) => !cleared.some((c) => c === field),
          ),
        )
      : {};

  // After hydration, fill only empty fields from what the customer asked
  // this browser to remember. The contact fields are uncontrolled, so this
  // writes to the inputs; React's reset after an error restores what was
  // sent, as their defaultValue.
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const rememberRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const saved = readContact();
    if (!saved) return;
    if (nameRef.current && !nameRef.current.value) {
      nameRef.current.value = saved.name;
    }
    if (phoneRef.current && !phoneRef.current.value) {
      phoneRef.current.value = saved.phone;
    }
    if (rememberRef.current) rememberRef.current.checked = true;
  }, []);

  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") summaryRef.current?.focus();
    if (state.status === "created") writeContact(state.remember);
  }, [state]);

  if (state.status === "created") {
    return <OrderSuccess orderPath={state.orderPath} summary={state.summary} />;
  }

  const day = days.find((d) => d.date === date) ?? days[0];
  // After a refresh the chosen day may be gone; the shown day is the chosen one.
  const selected = day?.date ?? "";
  if (!day) return null;
  const itemOf = (id: string) => day.items.find((i) => i.productId === id);
  const count = (id: string) => {
    const n = Number(quantities[id]);
    return Number.isInteger(n) && n > 0 ? n : 0;
  };
  const chosen = products.filter((p) => itemOf(p.id)?.state === "open");
  const pieces = chosen.reduce((sum, p) => sum + count(p.id), 0);
  const total = chosen.reduce((sum, p) => sum + count(p.id) * p.price, 0);

  function pickDay(next: FormDay) {
    setDate(next.date);
    edited("pickupDate");
    // Keep the quantities, but never above what the new day has left.
    let changed = false;
    const fitted: Record<string, string> = {};
    for (const [id, value] of Object.entries(quantities)) {
      const item = next.items.find((i) => i.productId === id);
      const max = item?.state === "open" ? item.remaining : 0;
      const n = count(id);
      if (n > max) changed = true;
      fitted[id] = n > max ? (max > 0 ? String(max) : "") : value;
    }
    setQuantities(fitted);
    setAdjusted(changed);
  }

  function setQuantity(id: string, value: string) {
    setQuantities((q) => ({ ...q, [id]: value }));
    setAdjusted(false);
    edited("items");
  }

  const summary = FIELD_ORDER.flatMap((field) =>
    (errors[field] ?? []).map((text) => ({ field, text })),
  );
  const firstOpen = products.find((p) => itemOf(p.id)?.state === "open");
  const anchor: Record<OrderField, string> = {
    pickupDate: `day-${selected}`,
    items: firstOpen ? `qty-${firstOpen.id}` : "products",
    pickupTime: "pickupTime",
    customerName: "customerName",
    phone: "phone",
  };
  const message = state.status === "error" ? state.message : undefined;
  const showSummary = summary.length > 0 || !!message;

  return (
    <form action={formAction} noValidate className="flex flex-col gap-8">
      <p className="-mt-4 text-muted-foreground">{intro}</p>
      {yourOrders}

      {showSummary && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          aria-labelledby="error-summary-title"
          className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
        >
          <h2 id="error-summary-title" className="font-semibold">
            Objednávku nejde odeslat
          </h2>
          {message && <p>{message}</p>}
          {summary.length > 0 && (
            <ul className="flex flex-col">
              {summary.map(({ field, text }) => (
                <li key={`${field}-${text}`}>
                  <a
                    href={`#${anchor[field]}`}
                    onClick={(e) => {
                      // Move focus to the field, not only scroll to it.
                      const target = document.getElementById(anchor[field]);
                      if (!target) return;
                      e.preventDefault();
                      target.focus();
                    }}
                    className="inline-flex min-h-11 items-center text-destructive underline underline-offset-4"
                  >
                    {text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <fieldset
        // min-w-0: a fieldset is min-content wide by default, so the day
        // strip would widen the page instead of scrolling.
        className="flex min-w-0 flex-col gap-3"
        aria-describedby={errors.pickupDate ? "pickupDate-error" : undefined}
      >
        <legend className="mb-3 text-lg font-semibold">Den vyzvednutí</legend>
        <FieldError id="pickupDate-error" messages={errors.pickupDate} />
        <DayStrip days={days} date={selected} onPick={pickDay} />
      </fieldset>

      <section className="flex flex-col gap-3" aria-labelledby="products">
        <h2
          id="products"
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {`Pečivo na ${day.title}`}
        </h2>
        <FieldError id="items-error" messages={errors.items} />
        {adjusted && (
          <p role="status" className="text-sm text-muted-foreground">
            Některé položky na tento den nejsou, upravili jsme množství.
          </p>
        )}
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {products.map((product) => {
            const item = itemOf(product.id);
            return (
              <ProductRow
                key={product.id}
                product={product}
                state={item?.state ?? "not_baked"}
                remaining={item?.remaining ?? 0}
                note={item?.note ?? null}
                value={quantities[product.id] ?? ""}
                invalid={!!errors.items}
                onChange={(value) => setQuantity(product.id, value)}
              />
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-5" aria-label="Kontakt">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pickupTime">Čas vyzvednutí (nepovinné)</Label>
          <Input
            id="pickupTime"
            name="pickupTime"
            type="time"
            step={900}
            defaultValue={values?.pickupTime}
            onChange={() => edited("pickupTime")}
            aria-invalid={!!errors.pickupTime || undefined}
            aria-describedby={
              errors.pickupTime ? "pickupTime-error" : undefined
            }
            className="w-40"
          />
          <FieldError id="pickupTime-error" messages={errors.pickupTime} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="customerName">Jméno</Label>
          <Input
            id="customerName"
            name="customerName"
            autoComplete="name"
            ref={nameRef}
            defaultValue={values?.customerName}
            onChange={() => edited("customerName")}
            aria-invalid={!!errors.customerName || undefined}
            aria-describedby={
              errors.customerName ? "customerName-error" : undefined
            }
          />
          <FieldError id="customerName-error" messages={errors.customerName} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Telefon</Label>
          <p id="phone-hint" className="text-sm text-muted-foreground">
            Například 601 234 567
          </p>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            ref={phoneRef}
            defaultValue={values?.phone}
            onChange={() => edited("phone")}
            aria-invalid={!!errors.phone || undefined}
            aria-describedby={
              errors.phone ? "phone-hint phone-error" : "phone-hint"
            }
          />
          <FieldError id="phone-error" messages={errors.phone} />
        </div>

        <div className="flex flex-col">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              name="remember"
              ref={rememberRef}
              defaultChecked={values?.remember}
              aria-describedby="remember-hint"
              className="size-5 shrink-0 cursor-pointer accent-primary"
            />
            Zapamatovat si mě v tomto prohlížeči
          </label>
          <p id="remember-hint" className="pl-8 text-sm text-muted-foreground">
            Jméno, telefon a odkazy na objednávky (cookie) zůstanou jen v tomto
            prohlížeči.
          </p>
        </div>
      </section>

      {/* People never see or fill this; form bots often do. */}
      <div aria-hidden className="sr-only">
        <label htmlFor="website">Web</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {/* A floating summary, apart from the list it sums up. */}
      <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-4 rounded-2xl border bg-card/95 py-2.5 pr-2.5 pl-5 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <p aria-live="polite" className="flex flex-col tabular-nums">
          {pieces > 0 ? (
            <>
              <span className="text-xl font-semibold tracking-tight sm:text-2xl">
                <RollingNumber text={formatPrice(total)} />
              </span>
              <span className="text-sm text-muted-foreground sm:text-base">
                <RollingNumber text={`${pieces} ks`} />
              </span>
            </>
          ) : (
            <span className="text-base text-muted-foreground sm:text-lg">
              Vyberte pečivo
            </span>
          )}
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-12 bg-crust px-6 text-base text-crust-foreground hover:bg-crust/85"
        >
          {pending ? "Odesílám…" : "Odeslat objednávku"}
        </Button>
      </div>
    </form>
  );
}

const DOT = {
  plenty: "bg-success",
  few: "bg-warning",
  none: "bg-muted-foreground/50",
} as const;

/** How much a day offers: kinds still orderable, and whether stock is thin. */
function availability(day: FormDay): {
  level: keyof typeof DOT;
  label: string;
} {
  const open = day.items.filter((i) => i.state === "open");
  if (open.length === 0) return { level: "none", label: "Nic" };
  // A note on an open item means only a few pieces are left.
  const thin =
    open.filter((i) => i.note).length +
    day.items.filter((i) => i.state === "sold_out").length;
  return {
    level: thin * 2 >= open.length ? "few" : "plenty",
    label: `${open.length} ${open.length === 1 ? "druh" : open.length < 5 ? "druhy" : "druhů"}`,
  };
}

/** "prosinec 2026" for a day's month. */
function monthLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("cs-CZ", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Every bookable day in one row, as booking sites do: swipe on a phone,
 * arrows on a laptop. The month above follows the scroll. The days are
 * native radios, so the form posts the day without script.
 */
function DayStrip({
  days,
  date,
  onPick,
}: {
  days: FormDay[];
  date: string;
  onPick: (day: FormDay) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [month, setMonth] = useState(() =>
    monthLabel(date || (days[0]?.date ?? "")),
  );
  const [edges, setEdges] = useState({ start: true, end: false });

  /** The month of the first day in view, and whether the row can scroll. */
  function sync() {
    const el = strip.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>("[data-date]")];
    const first = items.find(
      (item) => item.offsetLeft + item.offsetWidth / 2 >= el.scrollLeft,
    );
    if (first?.dataset.date) setMonth(monthLabel(first.dataset.date));
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  }

  // Start with the chosen day in view, without moving the page.
  useEffect(() => {
    const el = strip.current;
    const chosen = el?.querySelector<HTMLElement>(`[data-date="${date}"]`);
    if (
      el &&
      chosen &&
      chosen.offsetLeft > el.clientWidth - chosen.offsetWidth
    ) {
      el.scrollLeft = chosen.offsetLeft - el.clientWidth / 3;
    }
    sync();
    // Only on mount: later the customer scrolls on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function page(direction: 1 | -1) {
    const el = strip.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p
          aria-live="polite"
          className="font-medium text-muted-foreground first-letter:uppercase"
        >
          {month}
        </p>
        <div className="hidden gap-1 sm:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Předchozí dny"
            disabled={edges.start}
            onClick={() => page(-1)}
            className="rounded-full"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Další dny"
            disabled={edges.end}
            onClick={() => page(1)}
            className="rounded-full"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
      </div>
      <div
        ref={strip}
        onScroll={sync}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {days.map((d) => {
          const offer = availability(d);
          return (
            <label
              key={d.date}
              data-date={d.date}
              className="relative flex h-24 w-20 shrink-0 cursor-pointer snap-start flex-col items-center justify-center gap-0.5 rounded-xl border bg-card transition-colors not-has-checked:hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
            >
              <input
                id={`day-${d.date}`}
                type="radio"
                name="pickupDate"
                value={d.date}
                checked={d.date === date}
                onChange={() => onPick(d)}
                aria-label={d.title}
                className="sr-only"
              />
              <span className="text-sm opacity-70">{d.chip}</span>
              <span className="text-lg leading-tight font-semibold tabular-nums">
                {d.chipDate}
              </span>
              {/* What the day offers at a glance, like prices on a fare
                calendar: how many kinds, and a dot for how much is left. */}
              <span className="mt-0.5 flex items-center gap-1 text-sm opacity-80">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", DOT[offer.level])}
                />
                {offer.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ProductRow({
  product,
  state,
  remaining,
  note,
  value,
  invalid,
  onChange,
}: {
  product: FormProduct;
  state: FormDay["items"][number]["state"];
  remaining: number;
  note: string | null;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const open = state === "open";
  const n = Number(value);
  const current = Number.isInteger(n) && n > 0 ? n : 0;
  return (
    <li
      className={cn(
        "flex min-h-18 items-center justify-between gap-4 px-4 py-3 transition-colors",
        !open && "bg-muted/40",
        // Chosen: a tinted row with an accent edge, clear at a glance.
        current > 0 && "bg-crust/10 shadow-[inset_4px_0_0_var(--color-crust)]",
      )}
    >
      <div className={cn("min-w-0", !open && "opacity-60")}>
        <p
          className={cn(
            "font-medium sm:text-lg",
            current > 0 && "font-semibold",
          )}
        >
          {product.name}
        </p>
        <p className="text-sm text-muted-foreground sm:text-base">
          {state === "not_baked" ? (
            note
          ) : (
            <>
              <span className="font-semibold text-crust tabular-nums">
                {product.priceLabel}
              </span>
              {note && (
                <>
                  <span aria-hidden> · </span>
                  <span
                    className={cn(
                      state === "open" && "font-medium text-foreground",
                    )}
                  >
                    {note}
                  </span>
                </>
              )}
            </>
          )}
        </p>
      </div>
      {!open && (
        <Badge variant="outline" className="h-8 px-3 text-muted-foreground">
          {state === "sold_out" ? "Vyprodáno" : "Tento den nepečeme"}
        </Badge>
      )}
      {open && (
        // One rounded control, so the three parts read as a single stepper.
        <div
          className={cn(
            "flex shrink-0 items-center rounded-full border bg-background p-0.5 transition-colors",
            current > 0 && "border-crust/60 bg-crust/15",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Ubrat: ${product.name}`}
            disabled={current === 0}
            onClick={() => onChange(current > 1 ? String(current - 1) : "")}
            className={cn(
              "rounded-full",
              current > 0 && "text-crust hover:bg-crust/15 hover:text-crust",
            )}
          >
            <MinusIcon aria-hidden />
          </Button>
          <Input
            id={`qty-${product.id}`}
            name={`qty.${product.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={remaining}
            placeholder="0"
            aria-label={`Počet kusů: ${product.name}`}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "items-error" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              "h-11 w-10 [appearance:textfield] rounded-none border-0 bg-transparent px-0 text-center text-base tabular-nums md:text-base shadow-none focus-visible:ring-0 dark:bg-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              current > 0 && "font-semibold",
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Přidat: ${product.name}`}
            disabled={current >= remaining}
            onClick={() => onChange(String(current + 1))}
            className={cn(
              "rounded-full",
              current > 0 && "text-crust hover:bg-crust/15 hover:text-crust",
            )}
          >
            <PlusIcon aria-hidden />
          </Button>
        </div>
      )}
    </li>
  );
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <div id={id} className="flex flex-col gap-1 text-sm text-destructive">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}
