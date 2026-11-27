// The public order form (R2): a customer orders without an account, the
// browser remembers name and phone on request, and errors are explained.
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { reservation, reservationItem } from "../src/lib/db/schema";
import { openDb, resetData } from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));
// A customer, not staff.
test.use({ storageState: { cookies: [], origins: [] } });

const NAME = "Online Zákaznice";

test("orders for the nearest day and remembers the contact", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("radio").first()).toBeChecked();

  const add = (name: string) =>
    page.getByRole("button", { name: `Přidat: ${name}`, exact: true });
  await add("Rohlík").click();
  await add("Rohlík").click();
  await add("Kaiserka").click();
  await expect(page.getByLabel("Počet kusů: Rohlík")).toHaveValue("2");
  await expect(page.getByText("3 ks", { exact: true })).toBeVisible();

  await page.getByLabel("Jméno", { exact: true }).fill(NAME);
  await page.getByLabel("Telefon", { exact: true }).fill("601 234 567");
  await page.getByLabel(/Zapamatovat jméno a telefon/).check();
  await page.getByRole("button", { name: "Odeslat objednávku" }).click();

  await expect(
    page.getByRole("heading", { name: "Objednávka přijata" }),
  ).toBeFocused();
  await expect(page.getByText(/\/objednavka\/[\w-]{43}$/)).toBeVisible();
  await expect(page.getByText("2× Rohlík")).toBeVisible();

  const [saved] = await database.db
    .select()
    .from(reservation)
    .where(eq(reservation.customerName, NAME));
  expect(saved).toMatchObject({
    source: "online",
    status: "reserved",
    customerPhone: "+420601234567",
  });
  const items = await database.db
    .select()
    .from(reservationItem)
    .where(eq(reservationItem.reservationId, saved?.id ?? ""));
  expect(items.map((i) => [i.productName, i.quantity]).sort()).toEqual([
    ["Kaiserka", 1],
    ["Rohlík", 2],
  ]);

  await page.getByRole("button", { name: "Nová objednávka" }).click();
  await expect(page.getByLabel("Jméno", { exact: true })).toHaveValue(NAME);
  await expect(page.getByLabel("Telefon", { exact: true })).toHaveValue(
    "601 234 567",
  );
  await expect(page.getByLabel(/Zapamatovat jméno a telefon/)).toBeChecked();

  await page.getByRole("link", { name: "Přihlášení pro pekárnu" }).click();
  await expect(page).toHaveURL(/\/prihlaseni$/);
});

test("explains what is missing and keeps what was typed", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Telefon", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Odeslat objednávku" }).click();

  const summary = page.getByRole("heading", {
    name: "Objednávku nejde odeslat",
  });
  await expect(summary).toBeVisible();
  for (const text of [
    "Vyberte aspoň jeden výrobek.",
    "Zadejte jméno.",
    "Zadejte telefon ve tvaru 601 234 567 nebo +420 601 234 567.",
  ]) {
    // In the summary and next to the field.
    await expect(page.getByText(text)).toHaveCount(2);
  }
  await expect(page.getByLabel("Telefon", { exact: true })).toHaveValue("123");
  await expect(page.getByRole("radio").first()).toBeChecked();

  // Correcting a field removes its message.
  await page.getByLabel("Jméno", { exact: true }).fill(NAME);
  await expect(page.getByText("Zadejte jméno.")).toHaveCount(0);
  const saved = await database.db
    .select()
    .from(reservation)
    .where(eq(reservation.customerName, NAME));
  expect(saved).toEqual([]);
});
