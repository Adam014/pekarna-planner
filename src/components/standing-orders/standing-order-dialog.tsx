"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  endStandingOrder,
  type EndState,
  saveStandingOrder,
  type StandingOrderFormState,
} from "@/app/(staff)/trvale/actions";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/components/new-reservation/customer-picker";
import { WEEKDAY_SHORT } from "@/components/new-reservation/messages";
import { QuantityStepper } from "@/components/new-reservation/quantity-stepper";
import { formatBakeDays } from "@/components/products/messages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { unbakedWeekdays } from "@/lib/domain/standing-orders";
import { cn } from "@/lib/utils";
import {
  standingOrderFormInput,
  type StandingOrderFormInput,
} from "@/lib/validators/reservation";
import {
  endConfirmMessage,
  endedMessage,
  FIELD_MESSAGE,
  formatTime,
  inactiveNotice,
  issueMessages,
  NEW_ORDER_HINT,
  notBakedHint,
  REJECTED_MESSAGE,
  RENAME_HINT,
  savedMessage,
  SKIPPED_HINT,
  skippedToast,
  type StandingOrderField,
} from "./messages";

/** A standing order as the list and the dialog show it. */
export type StandingOrderView = {
  id: string;
  customerName: string;
  /** E.164, sent back on save. */
  phone: string;
  phoneDisplay: string;
  weekdays: number[];
  /** 'HH:MM' or null. */
  pickupTime: string | null;
  note: string | null;
  active: boolean;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    productActive: boolean;
  }[];
  /** Days skipped for the limit and products off the offer, as text. */
  warnings: string[];
};

/** What every dialog on the page needs, made on the server. */
export type FormContext = {
  /** Products on offer, for the form. */
  products: { id: string; name: string; bakeDays: number[] }[];
  customers: CustomerOption[];
  /** "Změny platí od pátku 28. listopadu. …" */
  appliesFrom: string;
  /** "pátku 28. listopadu": the first day an end removes. */
  endFrom: string;
  /** Tomorrow's weekday when its cutoff passed, so its day stays on end. */
  closedTomorrowWeekday: number | null;
};

type Mode = "new" | "edit" | "view" | "reuse";

const ID = {
  customer: "trvale-customer",
  customerName: "trvale-name",
  phone: "trvale-phone",
  pickupTime: "trvale-time",
  note: "trvale-note",
} as const;
const weekdayId = (day: number) => `trvale-day-${day}`;
const productId = (id: string) => `trvale-product-${id}`;
const errorId = (id: string) => `${id}-error`;

/**
 * Adds a standing order (without `order`), edits an active one, or shows an
 * ended one with "Použít znovu", in a dialog opened by `trigger`. Closing
 * the dialog drops the form, so it opens fresh each time.
 */
export function StandingOrderDialog({
  order,
  context,
  trigger,
}: {
  order?: StandingOrderView;
  context: FormContext;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reuse, setReuse] = useState(false);
  // Derived, not stored: an order ended while its row stays mounted opens
  // as ended the next time.
  const mode: Mode = !order
    ? "new"
    : order.active
      ? "edit"
      : reuse
        ? "reuse"
        : "view";

  const title =
    mode === "edit"
      ? "Upravit trvalou objednávku"
      : mode === "view"
        ? "Ukončená trvalá objednávka"
        : "Nová trvalá objednávka";
  const description =
    mode === "edit"
      ? context.appliesFrom
      : mode === "view"
        ? "Už nevytváří žádné objednávky. Podle ní můžete založit novou."
        : NEW_ORDER_HINT;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReuse(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {mode === "view" ? (
          order && <EndedDetails order={order} onReuse={() => setReuse(true)} />
        ) : (
          <StandingOrderForm
            key={mode}
            mode={mode}
            order={order}
            context={context}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EndedDetails({
  order,
  onReuse,
}: {
  order: StandingOrderView;
  onReuse: () => void;
}) {
  const rows: [string, string][] = [
    ["Zákazník", `${order.customerName} · ${order.phoneDisplay}`],
    ["Dny vyzvednutí", formatBakeDays(order.weekdays)],
    ...(order.pickupTime
      ? [["Čas", formatTime(order.pickupTime)] as [string, string]]
      : []),
    [
      "Výrobky",
      order.items.map((i) => `${i.productName} ${i.quantity} ks`).join(", "),
    ],
    ...(order.note ? [["Poznámka", order.note] as [string, string]] : []),
  ];
  return (
    <>
      <dl className="flex flex-col gap-4">
        {rows.map(([term, value]) => (
          <div key={term} className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Zavřít
          </Button>
        </DialogClose>
        <Button
          type="button"
          className="bg-crust text-crust-foreground hover:bg-crust/90"
          onClick={onReuse}
        >
          Použít znovu
        </Button>
      </DialogFooter>
    </>
  );
}

type Customer =
  | { kind: "none" }
  | { kind: "existing"; option: CustomerOption }
  /** A new customer typed in, with "Hledat" to go back to the search. */
  | { kind: "new"; name: string; phone: string }
  /** The customer of an edited or reused order, as two plain fields. */
  | { kind: "fields"; name: string; phone: string };

function StandingOrderForm({
  mode,
  order,
  context,
  onDone,
}: {
  mode: Exclude<Mode, "view">;
  order?: StandingOrderView;
  context: FormContext;
  onDone: () => void;
}) {
  const { products } = context;
  const editing = mode === "edit";
  const [state, dispatch, pending] = useActionState(
    async (prev: StandingOrderFormState, payload: StandingOrderFormInput) => {
      const result = await saveStandingOrder(prev, payload);
      if (result.status === "saved") {
        toast.success(savedMessage(result.customerName), {
          id: "standing-order-saved",
          description: result.notBaked.join(" ") || undefined,
        });
        if (result.skipped.length > 0) {
          toast.warning(skippedToast(result.skipped), {
            id: "standing-order-skipped",
            description: SKIPPED_HINT,
            duration: 10_000,
          });
        }
        onDone();
      }
      return result;
    },
    { status: "idle" },
  );

  const offered = new Set(products.map((p) => p.id));
  const [customer, setCustomer] = useState<Customer>(
    order && mode !== "new"
      ? { kind: "fields", name: order.customerName, phone: order.phoneDisplay }
      : { kind: "none" },
  );
  const [weekdays, setWeekdays] = useState<number[]>(order?.weekdays ?? []);
  const [time, setTime] = useState(order?.pickupTime ?? "");
  const [note, setNote] = useState(order?.note ?? "");
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      (order?.items ?? [])
        .filter((i) => offered.has(i.productId))
        .map((i) => [i.productId, i.quantity]),
    ),
  );
  const [errors, setErrors] = useState<
    Partial<Record<StandingOrderField, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  const [serverErrors, setServerErrors] = useState<Partial<
    Record<StandingOrderField, string>
  > | null>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "invalid") {
      const fields = forCustomer(state.fields);
      setErrors(fields);
      setServerErrors(fields);
    }
    if (state.status === "rejected") {
      setFormError(REJECTED_MESSAGE[state.reason]);
    }
  }

  // An error only the server finds (a wrong phone) gets focus too.
  const firstProduct = products[0]?.id ?? "";
  useEffect(() => {
    if (serverErrors) focusFirst(serverErrors, firstProduct);
  }, [serverErrors, firstProduct]);

  /** Without a customer yet, a missing name or phone means "pick one". */
  function forCustomer(fields: Partial<Record<StandingOrderField, string>>) {
    if (customer.kind === "new" || customer.kind === "fields") return fields;
    const { customerName, phone, ...rest } = fields;
    return customerName || phone
      ? { ...rest, customer: FIELD_MESSAGE.customer }
      : rest;
  }

  /** Any change hides the form error and the field's error. */
  function changed(...fields: StandingOrderField[]) {
    setFormError(null);
    if (fields.some((f) => errors[f])) {
      setErrors((e) => {
        const next = { ...e };
        for (const f of fields) delete next[f];
        return next;
      });
    }
  }

  function submit() {
    if (pending) return;
    const name =
      customer.kind === "existing"
        ? customer.option.name
        : customer.kind === "none"
          ? ""
          : customer.name;
    const phone =
      customer.kind === "existing"
        ? customer.option.phone
        : customer.kind === "none"
          ? ""
          : customer.phone;
    const payload: StandingOrderFormInput = {
      id: editing ? order?.id : undefined,
      customerName: name,
      phone,
      weekdays,
      pickupTime: time || undefined,
      note: note.trim() || undefined,
      // Products at 0 pieces are not in the order.
      items: products
        .map((p) => ({ productId: p.id, quantity: quantities[p.id] ?? 0 }))
        .filter((i) => i.quantity > 0),
    };
    // The same schema as the server, so most mistakes need no round trip.
    const parsed = standingOrderFormInput.safeParse(payload);
    if (!parsed.success) {
      const fields = forCustomer(issueMessages(parsed.error.issues));
      setErrors(fields);
      focusFirst(fields, firstProduct);
      return;
    }
    setErrors({});
    setFormError(null);
    startTransition(() => dispatch(payload));
  }

  const dropped = (order?.items ?? []).filter((i) => !offered.has(i.productId));

  return (
    <form
      noValidate
      aria-label={
        editing ? `Upravit ${order?.customerName}` : "Nová trvalá objednávka"
      }
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <section className="flex flex-col gap-2">
        {customer.kind === "fields" ? (
          <div className="flex flex-col gap-4">
            <TextField
              id={ID.customerName}
              label="Jméno"
              error={errors.customerName}
              hint={editing ? RENAME_HINT : undefined}
            >
              <Input
                id={ID.customerName}
                autoComplete="off"
                value={customer.name}
                maxLength={100}
                aria-invalid={!!errors.customerName || undefined}
                aria-describedby={describedBy(
                  errors.customerName && errorId(ID.customerName),
                  editing && `${ID.customerName}-hint`,
                )}
                onChange={(e) => {
                  setCustomer({ ...customer, name: e.target.value });
                  changed("customerName");
                }}
              />
            </TextField>
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
          </div>
        ) : (
          <>
            <Label htmlFor={ID.customer}>Zákazník</Label>
            {customer.kind === "none" && (
              <CustomerPicker
                id={ID.customer}
                customers={context.customers}
                invalid={!!errors.customer}
                describedBy={errors.customer && errorId(ID.customer)}
                onPick={(option) => {
                  setCustomer({ kind: "existing", option });
                  changed("customer", "customerName", "phone");
                  requestAnimationFrame(() =>
                    document.getElementById(weekdayId(1))?.focus(),
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
                    document
                      .getElementById(isPhone ? ID.customerName : ID.phone)
                      ?.focus(),
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
              </div>
            )}
            <FieldError id={ID.customer} error={errors.customer} />
          </>
        )}
      </section>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errors.weekdays && errorId("trvale-weekdays")}
      >
        <legend className="mb-2 text-sm font-medium">Dny vyzvednutí</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, i) => {
            const day = i + 1;
            return (
              <label
                key={label}
                className={cn(
                  "flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border bg-card px-3 text-sm font-medium transition-colors not-has-checked:hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  errors.weekdays && "border-destructive",
                )}
              >
                <input
                  id={weekdayId(day)}
                  type="checkbox"
                  name="weekdays"
                  value={day}
                  checked={weekdays.includes(day)}
                  aria-invalid={!!errors.weekdays || undefined}
                  className="sr-only"
                  onChange={(e) => {
                    setWeekdays(
                      e.target.checked
                        ? [...weekdays, day].toSorted((a, b) => a - b)
                        : weekdays.filter((d) => d !== day),
                    );
                    changed("weekdays");
                  }}
                />
                {label}
              </label>
            );
          })}
        </div>
        <FieldError id="trvale-weekdays" error={errors.weekdays} />
      </fieldset>

      <TextField
        id={ID.pickupTime}
        label="Čas vyzvednutí (nepovinné)"
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

      <TextField id={ID.note} label="Poznámka (nepovinné)" error={errors.note}>
        <Textarea
          id={ID.note}
          value={note}
          maxLength={500}
          aria-invalid={!!errors.note || undefined}
          aria-describedby={errors.note && errorId(ID.note)}
          onChange={(e) => {
            setNote(e.target.value);
            changed("note");
          }}
        />
      </TextField>

      <section
        aria-labelledby="trvale-products"
        className="flex flex-col gap-2"
      >
        <h3 id="trvale-products" className="text-sm font-medium">
          Výrobky
        </h3>
        {dropped.length > 0 && (
          <p className="text-sm text-warning-foreground">
            <TriangleAlertIcon
              aria-hidden
              className="mr-1.5 inline size-4 align-[-0.125em]"
            />
            {inactiveNotice(dropped.map((i) => i.productName))}
          </p>
        )}
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nejdřív přidejte výrobky na stránce{" "}
            <Link
              href="/vyrobky"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Výrobky
            </Link>
            .
          </p>
        ) : (
          <ul
            className={cn(
              "divide-y overflow-hidden rounded-xl border bg-card",
              errors.items && "border-destructive",
            )}
          >
            {products.map((p) => {
              const quantity = quantities[p.id] ?? 0;
              const unbaked =
                quantity > 0 ? unbakedWeekdays(weekdays, p.bakeDays) : [];
              const hintId = `${productId(p.id)}-hint`;
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2 pr-2 pl-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{p.name}</p>
                    {unbaked.length > 0 && (
                      <p
                        id={hintId}
                        className="text-sm text-warning-foreground"
                      >
                        {notBakedHint(unbaked)}
                      </p>
                    )}
                  </div>
                  <QuantityStepper
                    id={productId(p.id)}
                    label={p.name}
                    value={quantity}
                    invalid={!!errors.items}
                    describedBy={describedBy(
                      errors.items && errorId("trvale-items"),
                      unbaked.length > 0 && hintId,
                    )}
                    onChange={(value) => {
                      setQuantities({ ...quantities, [p.id]: value });
                      changed("items");
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
        <FieldError id="trvale-items" error={errors.items} />
      </section>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <DialogFooter className="sm:justify-between">
        {editing && order ? (
          <EndButton order={order} context={context} onEnded={onDone} />
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Zrušit
            </Button>
          </DialogClose>
          <Button
            type="submit"
            aria-disabled={pending || undefined}
            className="bg-crust text-crust-foreground hover:bg-crust/90"
          >
            {pending ? "Ukládám…" : "Uložit"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

/** "Ukončit objednávku" with a confirmation (NN/g): ending cannot be undone. */
function EndButton({
  order,
  context,
  onEnded,
}: {
  order: StandingOrderView;
  context: FormContext;
  onEnded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(
    async (prev: EndState, id: string) => {
      const result = await endStandingOrder(prev, id);
      if (result.status === "ended") {
        toast.success(endedMessage(order.customerName), {
          id: "standing-order-ended",
        });
        setOpen(false);
        onEnded();
      }
      return result;
    },
    { status: "idle" },
  );
  const closedTomorrow =
    context.closedTomorrowWeekday !== null &&
    order.weekdays.includes(context.closedTomorrowWeekday);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-destructive/50"
        >
          Ukončit objednávku
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Ukončit trvalou objednávku?
          </DialogTitle>
          <DialogDescription>
            {endConfirmMessage(
              order.customerName,
              context.endFrom,
              closedTomorrow,
            )}
          </DialogDescription>
        </DialogHeader>
        {state.status === "rejected" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {REJECTED_MESSAGE.not_found}
          </p>
        )}
        <DialogFooter>
          {/* First in the DOM, so it takes the focus, not the end. */}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Ponechat
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) startTransition(() => dispatch(order.id));
            }}
          >
            {pending ? "Ukončuji…" : "Ukončit objednávku"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Moves focus to the first field with an error, in the form's order. */
function focusFirst(
  fields: Partial<Record<StandingOrderField, string>>,
  firstProductId: string,
) {
  const targets: [StandingOrderField, string][] = [
    ["customer", ID.customer],
    ["customerName", ID.customerName],
    ["phone", ID.phone],
    ["weekdays", weekdayId(1)],
    ["pickupTime", ID.pickupTime],
    ["note", ID.note],
    ["items", productId(firstProductId)],
  ];
  const target = targets.find(([field]) => fields[field]);
  if (target) document.getElementById(target[1])?.focus();
}

function describedBy(...ids: (string | false | undefined)[]) {
  return ids.filter(Boolean).join(" ") || undefined;
}

function TextField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
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
