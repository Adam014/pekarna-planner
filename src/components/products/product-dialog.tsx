"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  type ProductFormState,
  saveProduct,
} from "@/app/(staff)/vyrobky/actions";
import { WEEKDAY_SHORT } from "@/components/new-reservation/messages";
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
import type { ProductRow } from "@/lib/services/products.service";
import { cn } from "@/lib/utils";
import {
  priceInputValue,
  productInput,
  type ProductInput,
} from "@/lib/validators/product";
import { issueMessages, NOT_FOUND, type ProductField } from "./messages";
import { ProductPhotoField } from "./product-photo-field";

const errorId = (field: string) => `product-${field}-error`;

/**
 * Adds a product (without `product`) or edits one, in a dialog opened by
 * `trigger`. Closing the dialog drops the form, so it opens fresh each time.
 */
export function ProductDialog({
  product,
  trigger,
}: {
  product?: ProductRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {product ? "Upravit výrobek" : "Nový výrobek"}
          </DialogTitle>
          <DialogDescription>
            Změny platí pro nové objednávky. Přijaté objednávky zůstanou.
          </DialogDescription>
        </DialogHeader>
        {/* Saved on its own: a photo needs the product to exist first. */}
        {product ? (
          <ProductPhotoField
            productId={product.id}
            name={product.name}
            imageUrl={product.imageUrl}
          />
        ) : (
          <p className="-mt-2 text-sm text-muted-foreground">
            Fotku přidáte po uložení výrobku.
          </p>
        )}
        <ProductForm product={product} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({
  product,
  onSaved,
}: {
  product?: ProductRow;
  onSaved: () => void;
}) {
  const [state, dispatch, pending] = useActionState(
    async (prev: ProductFormState, payload: ProductInput) => {
      const result = await saveProduct(prev, payload);
      if (result.status === "saved") {
        toast.success(`Uloženo: ${result.name}`, { id: "product-saved" });
        onSaved();
      }
      return result;
    },
    { status: "idle" },
  );
  const [errors, setErrors] = useState<Partial<Record<ProductField, string>>>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state.status === "invalid") setErrors(state.fields);
    if (state.status === "rejected") setFormError(NOT_FOUND);
  }

  // An error only the server finds (a taken name) gets focus too.
  useEffect(() => {
    if (state.status !== "invalid") return;
    const first = Object.keys(state.fields)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }, [state]);

  function submit(form: HTMLFormElement) {
    if (pending) return;
    const data = new FormData(form);
    const text = (name: string) => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };
    const payload: ProductInput = {
      id: product?.id,
      name: text("name"),
      price: text("price"),
      dailyLimit: text("dailyLimit"),
      buffer: text("buffer"),
      bakeDays: data.getAll("bakeDays").map(Number),
      active: data.get("active") === "on",
    };
    // The same schema as the server, so most mistakes need no round trip.
    const parsed = productInput.safeParse(payload);
    if (!parsed.success) {
      const fields = issueMessages(parsed.error.issues);
      setErrors(fields);
      const first = Object.keys(fields)[0];
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});
    setFormError(null);
    startTransition(() => dispatch(payload));
  }

  /** Typing into a field hides its error. */
  function changed(name: string) {
    if (name in errors) {
      setErrors((e) =>
        Object.fromEntries(Object.entries(e).filter(([key]) => key !== name)),
      );
    }
  }

  return (
    <form
      ref={formRef}
      noValidate
      aria-label={product ? `Upravit ${product.name}` : "Nový výrobek"}
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
      onChange={(e) => {
        if (e.target instanceof HTMLInputElement) changed(e.target.name);
      }}
    >
      <Field name="name" label="Název" error={errors.name}>
        <Input
          id="product-name"
          name="name"
          autoComplete="off"
          defaultValue={product?.name}
          maxLength={60}
          aria-invalid={!!errors.name || undefined}
          aria-describedby={errors.name && errorId("name")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          name="price"
          label="Cena za kus"
          unit="v korunách"
          error={errors.price}
        >
          <Suffixed suffix="Kč">
            <Input
              id="product-price"
              name="price"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={product && priceInputValue(product.price)}
              className="pr-10 tabular-nums"
              aria-invalid={!!errors.price || undefined}
              aria-describedby={errors.price && errorId("price")}
            />
          </Suffixed>
        </Field>
        <Field
          name="dailyLimit"
          label="Denní limit"
          unit="v kusech"
          error={errors.dailyLimit}
        >
          <Suffixed suffix="ks">
            <Input
              id="product-dailyLimit"
              name="dailyLimit"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={product?.dailyLimit}
              className="pr-10 tabular-nums"
              aria-invalid={!!errors.dailyLimit || undefined}
              aria-describedby={errors.dailyLimit && errorId("dailyLimit")}
            />
          </Suffixed>
        </Field>
        <Field
          name="buffer"
          label="Rezerva pro pult"
          unit="v kusech"
          error={errors.buffer}
        >
          <Suffixed suffix="ks">
            <Input
              id="product-buffer"
              name="buffer"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={product?.buffer ?? 0}
              className="pr-10 tabular-nums"
              aria-invalid={!!errors.buffer || undefined}
              aria-describedby={errors.buffer && errorId("buffer")}
            />
          </Suffixed>
        </Field>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={errors.bakeDays && errorId("bakeDays")}
      >
        <legend className="mb-2 text-sm font-medium">Kdy se peče</legend>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_SHORT.map((label, i) => (
            <label
              key={label}
              className={cn(
                "flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border bg-card px-3 text-sm font-medium transition-colors not-has-checked:hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                errors.bakeDays && "border-destructive",
              )}
            >
              <input
                type="checkbox"
                name="bakeDays"
                value={i + 1}
                defaultChecked={product?.bakeDays.includes(i + 1)}
                aria-invalid={!!errors.bakeDays || undefined}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError name="bakeDays" error={errors.bakeDays} />
      </fieldset>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-3 font-medium">
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? true}
            aria-describedby="product-active-hint"
            className="size-5 cursor-pointer accent-primary"
          />
          V nabídce
        </label>
        <p
          id="product-active-hint"
          className="pl-8 text-sm text-muted-foreground"
        >
          Když není v nabídce, nejde objednat a trvalé objednávky ho přestanou
          přidávat.
        </p>
      </div>

      {formError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {formError}
        </p>
      )}

      <DialogFooter>
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
      </DialogFooter>
    </form>
  );
}

function Field({
  name,
  label,
  unit,
  error,
  children,
}: {
  name: ProductField;
  label: string;
  /** Read out with the label: the visible suffix is skipped by readers. */
  unit?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`product-${name}`}>
        {label}
        {unit && <span className="sr-only"> {unit}</span>}
      </Label>
      {children}
      <FieldError name={name} error={error} />
    </div>
  );
}

function Suffixed({
  suffix,
  children,
}: {
  suffix: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {children}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        {suffix}
      </span>
    </div>
  );
}

function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={errorId(name)} className="text-sm text-destructive">
      {error}
    </p>
  );
}
