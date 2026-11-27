/**
 * The owner's catalogue (R6). Orders keep their own copy of name and price
 * (ADR 0007), so a change here only applies to new orders; products are
 * deactivated, never deleted.
 */
import { DrizzleQueryError, desc, eq, sql } from "drizzle-orm";
import { DatabaseError } from "pg";
import type { Db } from "../db/types";
import { product } from "../db/schema";
import type { ProductValues } from "../validators/product";

export type ProductRow = {
  id: string;
  name: string;
  /** In haléře. */
  price: number;
  dailyLimit: number;
  buffer: number;
  bakeDays: number[];
  active: boolean;
  /** The photo URL, or null without one. */
  imageUrl: string | null;
};

/** Every product: those on offer first, each group by name the Czech way. */
export async function listProducts(db: Db): Promise<ProductRow[]> {
  return db
    .select({
      id: product.id,
      name: product.name,
      price: product.price,
      dailyLimit: product.dailyLimit,
      buffer: product.buffer,
      bakeDays: product.bakeDays,
      active: product.active,
      imageUrl: product.imageUrl,
    })
    .from(product)
    .orderBy(desc(product.active), sql`${product.name} collate "cs-CZ-x-icu"`);
}

export type SaveProductResult =
  | { status: "saved" }
  | { status: "rejected"; reason: "duplicate_name" | "not_found" };

/**
 * Creates the product without `id`, updates it with one. A name taken by
 * another product is caught from the unique index, not checked first: a
 * check before the write would race.
 */
export async function saveProduct(
  db: Db,
  { id, ...values }: ProductValues,
): Promise<SaveProductResult> {
  try {
    if (id === undefined) {
      await db.insert(product).values(values);
      return { status: "saved" };
    }
    const updated = await db
      .update(product)
      .set(values)
      .where(eq(product.id, id))
      .returning({ id: product.id });
    return updated.length > 0
      ? { status: "saved" }
      : { status: "rejected", reason: "not_found" };
  } catch (error) {
    if (isDuplicateName(error)) {
      return { status: "rejected", reason: "duplicate_name" };
    }
    throw error;
  }
}

/**
 * Sets or clears the product's photo. Returns the photo it replaced, so the
 * caller can delete the old file, or null when there is no such product.
 */
export async function setProductImage(
  db: Db,
  id: string,
  imageUrl: string | null,
): Promise<{ previous: string | null } | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ imageUrl: product.imageUrl })
      .from(product)
      .where(eq(product.id, id))
      .for("update");
    if (!row) return null;
    await tx.update(product).set({ imageUrl }).where(eq(product.id, id));
    return { previous: row.imageUrl };
  });
}

function isDuplicateName(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;
  return (
    cause instanceof DatabaseError &&
    cause.code === "23505" &&
    cause.constraint === "product_name_unique_idx"
  );
}
