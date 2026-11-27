"use client";

import { CalendarDaysIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  createPhoneReservation,
  type NewReservationState,
} from "@/app/(staff)/nova/actions";
import { Badge } from "@/components/ui/badge";
import { RollingNumber } from "@/components/rolling-number";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  phoneReservationInput,
  type PhoneReservationInput,
} from "@/lib/validators/reservation";
import { CustomerPicker, type CustomerOption } from "./customer-picker";
import {
  type Field,
  FIELD_MESSAGE,
  issueMessages,
  notBakedMessage,
  REJECTED_MESSAGE,
  savedMessage,
  soldOutMessage,
  weekdayOn,
} from "./messages";
import { QuantityStepper } from "./quantity-stepper";

export type ProductOption = {
  id: string;
  name: string;
  /** In haléře. */
  price: number;
  priceDisplay: string;
  bakeDays: number[];
};

export type DayOption = {
  date: string;
  /** ISO weekday, 1 = Monday. */
  weekday: number;
  /** "Dnes", "Zítra", "So 29." */
  pill: string;
  /** "Po 8. 12." for a day picked in the calendar. */
  short: string;
  /** "pátek 28. 11." for the toast. */
  long: string;
};

type Props = {
  products: ProductOption[];
  /** Every bookable day, today first. */
  days: DayOption[];
  /** Pieces still free by day and product id. */
  remaining: Record<string, Record<string, number>>;
  customers: CustomerOption[];
};

/** Days shown as pills; the rest are in "Jiný den". */
const PILL_DAYS = 7;

const ID = {
  customer: "nova-customer",
  customerName: "nova-name",
  phone: "nova-phone",
  pickupTime: "nova-time",
  note: "nova-note",
} as const;
const dayId = (date: string) => `nova-day-${date}`;
const productId = (id: string) => `nova-product-${id}`;
const errorId = (id: string) => `${id}-error`;

/**
 * "Nová rezervace" (R1). After a save the form clears for the next call and a
 * toast offers the day's list; the cleared form is a new mount, so it starts
 * with a new idempotency key and focus in the customer search.
 */
export function NewReservationForm(props: Props) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(
    async (prev: NewReservationState, payload: PhoneReservationInput) => {
      const result = await createPhoneReservation(prev, payload);
      if (result.status === "created") {
        const day = props.days.find((d) => d.date === result.date);
        toast.success(
          savedMessage(
            result.customerName,
            day?.long ?? result.date,
            result.pieces,
          ),
          {
            id: "saved",
            duration: 10_000,
            // On top, clear of the save button for the next call.
            position: "top-center",
            action: {
              label: "Zobrazit den",
              onClick: () => router.push(`/dnes?den=${result.date}`),
            },
          },
        );
      }
      return result;
    },
    { status: "idle" },
  );
  const [formKey, setFormKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "created") setFormKey(formKey + 1);
  }

  return (
    <ReservationForm
      key={formKey}
      {...props}
      state={state}
      pending={pending}
      send={(payload) => startTransition(() => dispatch(payload))}
    />
  );
}

type Customer =
  | { kind: "none" }
  | { kind: "existing"; option: CustomerOption }
  | { kind: "new"; name: string; phone: string };

function ReservationForm({
  products,
  days,
  remaining,
  customers,
  state,
  pending,
  send,
}: Props & {
  state: NewReservationState;
  pending: boolean;
  send: (payload: PhoneReservationInput) => void;
}) {
  const [customer, setCustomer] = useState<Customer>({ kind: "none" });
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** What the server said is left, for the products over the limit. */
  const [soldOut, setSoldOut] = useState<Record<string, number> | null>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  /** Counts refused submits, so the summary takes focus each time. */
  const [attempt, setAttempt] = useState(0);
  // Made on the first submit and kept until saved (ADR 0007).
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  const summaryRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  // Mounted after a save with that result: only later answers apply here.
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    applyAnswer(state);
  }

  useEffect(() => {
    if (attempt > 0) summaryRef.current?.focus();
  }, [attempt]);
  useEffect(() => {
    if (confirm) confirmRef.current?.focus();
  }, [confirm]);

  function applyAnswer(answer: NewReservationState) {
    switch (answer.status) {
      case "invalid":
        setErrors(forCustomer(answer.fields));
        setAttempt(attempt + 1);
        break;
      case "needs_confirmation":
        setConfirm(answer.products);
        break;
      case "sold_out":
        setSoldOut(answer.remaining);
        setAttempt(attempt + 1);
        break;
      case "rejected":
        if (answer.reason === "day_not_bookable") {
          setErrors({ pickupDate: REJECTED_MESSAGE.day_not_bookable });
        } else {
          setFormError(REJECTED_MESSAGE[answer.reason]);
        }
        if (answer.reason === "idempotency_conflict") setIdempotencyKey(null);
        setAttempt(attempt + 1);
        break;
    }
  }

  /** Without a new customer, a missing name or phone means no customer yet. */
  function forCustomer(fields: Partial<Record<Field, string>>) {
    if (customer.kind === "new") return fields;
    const { customerName, phone, ...rest } = fields;
    return customerName || phone
      ? { ...rest, customer: FIELD_MESSAGE.customer }
      : rest;
  }

  /** Any change to the order hides the confirmation and the field's error. */
  function changed(...fields: Field[]) {
    setConfirm(null);
    setFormError(null);
    if (fields.some((f) => errors[f])) {
      setErrors((e) => {
        const next = { ...e };
        for (const f of fields) delete next[f];
        return next;
      });
    }
  }

  const day = days.find((d) => d.date === date);
  const items = products
    .map((p) => ({ productId: p.id, quantity: quantities[p.id] ?? 0 }))
    .filter((i) => i.quantity > 0);
  const pieces = items.reduce((sum, i) => sum + i.quantity, 0);
  const total = products.reduce(
    (sum, p) => sum + (quantities[p.id] ?? 0) * p.price,
    0,
  );
  const left = (id: string) =>
    date === null ? undefined : (soldOut?.[id] ?? remaining[date]?.[id]);
  const overLimit = products.filter((p) => {
    const l = left(p.id);
    return l !== undefined && (quantities[p.id] ?? 0) > l;
  });

  function submit(confirmed = false) {
    if (pending) return;
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    setFormError(null);
    setSoldOut(null);
    const payload: PhoneReservationInput = {
      customerName:
        customer.kind === "existing"
          ? customer.option.name
          : customer.kind === "new"
            ? customer.name
            : "",
      phone:
        customer.kind === "existing"
          ? customer.option.phone
          : customer.kind === "new"
            ? customer.phone
            : "",
      pickupDate: date ?? "",
      pickupTime: time || undefined,
      note: note.trim() || undefined,
      items,
      idempotencyKey: key,
      confirmed,
    };
    // The same schema as the server, so most mistakes need no round trip.
    const parsed = phoneReservationInput.safeParse(payload);
    if (!parsed.success) {
      setErrors(forCustomer(issueMessages(parsed.error.issues)));
      setAttempt(attempt + 1);
      return;
    }
    setErrors({});
    send(payload);
  }

  const summary: { target: string | null; text: string }[] = [
    ...(formError ? [{ target: null, text: formError }] : []),
    ...(
      [
        ["customer", ID.customer],
        ["phone", ID.phone],
        ["customerName", ID.customerName],
        ["pickupDate", dayId(days[0]?.date ?? "")],
        ["pickupTime", ID.pickupTime],
        ["note", ID.note],
        ["items", productId(products[0]?.id ?? "")],
      ] as const
    ).flatMap(([field, target]) => {
      const text = errors[field];
      return text ? [{ target, text }] : [];
    }),
    ...(soldOut
      ? overLimit.map((p) => ({
          target: productId(p.id),
          text: `${p.name}: ${soldOutMessage(left(p.id) ?? 0)}`,
        }))
      : []),
  ];

  function focusField(id: string) {
    document.getElementById(id)?.focus();
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

  const otherDay = day && days.indexOf(day) >= PILL_DAYS ? day : undefined;
  const lastDay = days.at(-1)?.date;

  return (
    <form
      noValidate
      aria-label="Nová rezervace"
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {summary.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          aria-labelledby="nova-summary"
          className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 outline-none focus-visible:ring-3 focus-visible:ring-destructive/30"
        >
          <h2 id="nova-summary" className="font-semibold">
            Rezervaci nejde uložit
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {summary.map(({ target, text }) => (
              <li key={text}>
                {target ? (
                  <a
                    href={`#${target}`}
                    className="inline-flex min-h-11 items-center text-destructive underline underline-offset-4"
                    onClick={(e) => {
                      e.preventDefault();
                      focusField(target);
                    }}
                  >
                    {text}
                  </a>
                ) : (
                  <span className="text-destructive">{text}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <Label htmlFor={ID.customer} className="text-base font-semibold">
              Zákazník
            </Label>
            {customer.kind === "none" && (
              <CustomerPicker
                id={ID.customer}
                customers={customers}
                invalid={!!errors.customer}
                describedBy={errors.customer && errorId(ID.customer)}
                onPick={(option) => {
                  setCustomer({ kind: "existing", option });
                  changed("customer", "customerName", "phone");
                  // The call goes on with the day.
                  requestAnimationFrame(() =>
                    focusField(dayId(date ?? days[0]?.date ?? "")),
                  );
                }}
                onNew={(query) => {
                  const isPhone = /^[\d\s+()-]+$/.test(query.trim());
                  setCustomer({
                    kind: "new",
                    phone: isPhone ? query.trim() : "",
                    name: isPhone ? "" : query.trim(),
                  });
                  changed("customer");
                  requestAnimationFrame(() =>
                    focusField(isPhone ? ID.customerName : ID.phone),
                  );
                }}
              />
            )}
            {customer.kind === "existing" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-card py-1 pr-1 pl-4">
                <p className="min-w-0 truncate">
                  <span className="font-medium">{customer.option.name}</span>
                  <span className="text-muted-foreground">
                    {" · "}
                    <span className="tabular-nums">
                      {customer.option.phoneDisplay}
                    </span>
                  </span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCustomer({ kind: "none" });
                    changed();
                  }}
                >
                  Změnit
                </Button>
              </div>
            )}
            {customer.kind === "new" && (
              <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
                <div className="-my-1 flex items-center justify-between gap-3">
                  <span className="font-medium">Nový zákazník</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="-mr-2"
                    onClick={() => {
                      setCustomer({ kind: "none" });
                      changed("customerName", "phone");
                    }}
                  >
                    Hledat
                  </Button>
                </div>
                <TextField id={ID.phone} label="Telefon" error={errors.phone}>
                  <Input
                    id={ID.phone}
                    type="tel"
                    autoComplete="off"
                    value={customer.phone}
                    aria-invalid={!!errors.phone || undefined}
                    aria-describedby={errors.phone && errorId(ID.phone)}
                    onChange={(e) => {
                      setCustomer({ ...customer, phone: e.target.value });
                      changed("phone");
                    }}
                  />
                </TextField>
                <TextField
                  id={ID.customerName}
                  label="Jméno"
                  error={errors.customerName}
                >
                  <Input
                    id={ID.customerName}
                    autoComplete="off"
                    value={customer.name}
                    maxLength={100}
                    aria-invalid={!!errors.customerName || undefined}
                    aria-describedby={
                      errors.customerName && errorId(ID.customerName)
                    }
                    onChange={(e) => {
                      setCustomer({ ...customer, name: e.target.value });
                      changed("customerName");
                    }}
                  />
                </TextField>
              </div>
            )}
            <FieldError id={ID.customer} error={errors.customer} />
          </section>

          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={errors.pickupDate && errorId("nova-day")}
          >
            <legend className="mb-2 font-semibold">Den vyzvednutí</legend>
            <div className="flex flex-wrap gap-2">
              {days.slice(0, PILL_DAYS).map((d) => (
                <label
                  key={d.date}
                  className={cn(
                    "flex h-11 cursor-pointer items-center rounded-full border bg-card px-4 text-sm font-medium transition-colors not-has-checked:hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                    errors.pickupDate && "border-destructive",
                  )}
                >
                  <input
                    id={dayId(d.date)}
                    type="radio"
                    name="pickupDate"
                    value={d.date}
                    checked={date === d.date}
                    aria-invalid={!!errors.pickupDate || undefined}
                    onChange={() => {
                      setDate(d.date);
                      setSoldOut(null);
                      changed("pickupDate");
                    }}
                    className="sr-only"
                  />
                  {d.pill}
                </label>
              ))}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  aria-pressed={!!otherDay}
                  className={cn(
                    "rounded-full",
                    otherDay &&
                      "border-primary bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:hover:bg-primary/80",
                  )}
                  onClick={openPicker}
                >
                  <CalendarDaysIcon />
                  {otherDay ? otherDay.short : "Jiný den"}
                </Button>
                <input
                  ref={picker}
                  type="date"
                  tabIndex={-1}
                  aria-hidden
                  value={date ?? ""}
                  min={days[0]?.date}
                  max={lastDay}
                  className="pointer-events-none absolute inset-0 opacity-0"
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    if (days.some((d) => d.date === value)) {
                      setDate(value);
                      setSoldOut(null);
                      changed("pickupDate");
                    }
                  }}
                />
              </div>
            </div>
            <FieldError id="nova-day" error={errors.pickupDate} />
          </fieldset>

          <TextField
            id={ID.pickupTime}
            label="Čas (nepovinné)"
            error={errors.pickupTime}
          >
            <Input
              id={ID.pickupTime}
              type="time"
              step={900}
              value={time}
              className="w-36"
              aria-invalid={!!errors.pickupTime || undefined}
              aria-describedby={errors.pickupTime && errorId(ID.pickupTime)}
              onChange={(e) => {
                setTime(e.target.value);
                changed("pickupTime");
              }}
            />
          </TextField>

          <TextField
            id={ID.note}
            label="Poznámka (nepovinné)"
            error={errors.note}
          >
            <Textarea
              id={ID.note}
              value={note}
              maxLength={500}
              onChange={(e) => {
                setNote(e.target.value);
                changed("note");
              }}
            />
          </TextField>
        </div>

        <section
          aria-labelledby="nova-products"
          className="flex flex-col gap-2"
        >
          <h2 id="nova-products" className="font-semibold">
            Výrobky
          </h2>
          <ul
            className={cn(
              "divide-y overflow-hidden rounded-xl border bg-card",
              errors.items && "border-destructive",
            )}
          >
            {products.map((p) => {
              const quantity = quantities[p.id] ?? 0;
              const l = left(p.id);
              const over = l !== undefined && quantity > l;
              const notBaked = day && !p.bakeDays.includes(day.weekday);
              const soldOutDay = !notBaked && l === 0 && quantity === 0;
              // Staff can still book it (a not-baked day asks first), so the
              // stepper stays; the row only reads as unavailable.
              const unavailable = notBaked || soldOutDay;
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-3 py-2 pr-2 pl-4",
                    unavailable && quantity === 0 && "bg-hatched",
                  )}
                >
                  <div
                    className={cn(
                      "min-w-0",
                      unavailable && quantity === 0 && "opacity-60",
                    )}
                  >
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                      {p.name}
                      {unavailable && day && (
                        <Badge
                          variant="outline"
                          className="font-normal text-muted-foreground"
                        >
                          {notBaked
                            ? `${capitalize(weekdayOn(day.weekday))} nepečeme`
                            : "Vyprodáno"}
                        </Badge>
                      )}
                    </p>
                    <p
                      id={errorId(productId(p.id))}
                      className={cn(
                        "text-sm text-muted-foreground tabular-nums",
                        over && "font-medium text-destructive",
                      )}
                    >
                      {over
                        ? soldOutMessage(l)
                        : [p.priceDisplay, day && !unavailable && `zbývá ${l}`]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  </div>
                  <QuantityStepper
                    id={productId(p.id)}
                    label={p.name}
                    value={quantity}
                    invalid={over}
                    describedBy={
                      over
                        ? errorId(productId(p.id))
                        : errors.items && errorId("nova-items")
                    }
                    onChange={(value) => {
                      setQuantities({ ...quantities, [p.id]: value });
                      changed("items");
                    }}
                  />
                </li>
              );
            })}
          </ul>
          <FieldError id="nova-items" error={errors.items} />
        </section>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        {confirm && day && (
          <div
            ref={confirmRef}
            role="alert"
            tabIndex={-1}
            className="flex flex-col gap-3 rounded-xl border border-warning/50 bg-warning/10 p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-medium">
              {notBakedMessage(confirm, day.weekday)}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  changed();
                  focusField(dayId(date ?? ""));
                }}
              >
                Změnit
              </Button>
              <Button
                type="button"
                className="bg-crust text-crust-foreground hover:bg-crust/90"
                aria-disabled={pending || undefined}
                onClick={() => submit(true)}
              >
                {pending ? "Ukládám…" : "Uložit i tak"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="tabular-nums">
            <span className="font-semibold">
              <RollingNumber text={`${pieces} ks`} />
            </span>
            <span className="text-muted-foreground">
              {" · "}
              <RollingNumber text={formatPrice(total)} />
            </span>
          </p>
          {/* While the confirmation is open, its button is the one action. */}
          {!confirm && (
            <Button
              type="submit"
              size="lg"
              aria-disabled={pending || undefined}
              className="bg-crust text-crust-foreground hover:bg-crust/90"
            >
              {pending ? "Ukládám…" : "Uložit rezervaci"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={id} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={errorId(id)} className="text-sm text-destructive">
      {error}
    </p>
  );
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);
