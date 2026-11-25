import { check, pgTable, text } from "drizzle-orm/pg-core";
import { id, isE164, notBlank, timestamps } from "./columns";

/** One row per phone number; staff find customers by it. */
export const customer = pgTable(
  "customer",
  {
    id: id(),
    name: text("name").notNull(),
    /** E.164, e.g. +420601234567. Normalised before saving and searching. */
    phone: text("phone").notNull().unique(),
    /** Staff-only note, e.g. "always pays in cash". */
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    check("customer_name_check", notBlank(t.name)),
    check("customer_phone_check", isE164(t.phone)),
  ],
);
