import type { Metadata } from "next";
import { Suspense } from "react";
import { CutoffForm } from "@/components/products/cutoff-form";
import {
  AddProductButton,
  ProductList,
} from "@/components/products/product-list";
import { db } from "@/lib/db";
import { listProducts } from "@/lib/services/products.service";
import { cutoffTime } from "@/lib/services/settings";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Výrobky" };

// "Výrobky" (R6): the owner keeps the catalogue and the order cutoff. The
// session is read inside the Suspense boundaries (Cache Components).
export default function ProductsPage() {
  return (
    <main className="flex flex-col gap-6">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Výrobky</h1>
        <Suspense>
          <Add />
        </Suspense>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <Products />
      </Suspense>
    </main>
  );
}

async function Add() {
  await requireUser("owner");
  return <AddProductButton />;
}

async function Products() {
  await requireUser("owner");
  const [products, cutoff] = await Promise.all([
    listProducts(db),
    cutoffTime(db),
  ]);
  return (
    <div className="flex flex-col gap-10">
      <ProductList products={products} />
      {/* '18:00:00' from Postgres; the time input takes HH:MM. */}
      <CutoffForm time={cutoff.slice(0, 5)} />
    </div>
  );
}
