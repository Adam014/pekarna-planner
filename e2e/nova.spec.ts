// "Nová rezervace" (R1): staff take an order on the phone at a tablet.
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";
import { reservation } from "../src/lib/db/schema";
import { addDays, today, weekdayOf } from "../src/lib/domain/time";
import { openDb, orderCard, resetData } from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));

// Tablet landscape, the tablet by the phone.
test.use({ viewport: { width: 1180, height: 820 } });

const NAME = "Jana Dvořáková";

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/nova goes to the login", async ({ page }) => {
    await page.goto("/nova");
    await expect(page).toHaveURL(/\/prihlaseni/);
  });
});

test("saves a phone order and clears the form for the next call", async ({
  page,
}) => {
  const tomorrow = addDays(today(Temporal.Now.instant()), 1);
  await page.goto("/nova");

  const search = page.getByRole("combobox", { name: "Zákazník" });
  await expect(search).toBeFocused();
  await search.fill("777 000 201");
  await expect(
    page.getByRole("option", { name: /Jana Dvořáková/ }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(page.getByText(NAME, { exact: true })).toBeVisible();

  await page
    .locator("label")
    .filter({ hasText: /^Zítra$/ })
    .click();
  const add = page.getByRole("button", { name: "Přidat Rohlík" });
  await add.click();
  await add.click();
  await expect(page.getByText("2 ks", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Uložit rezervaci" }).click();
  // The demo bakery does not bake on Sundays: staff confirm.
  if (weekdayOf(tomorrow) === 7) {
    // Filtered: Next's route announcer is an alert too.
    await expect(
      page.getByRole("alert").filter({ hasText: "se v neděli" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Uložit i tak" }).click();
  }

  await expect(page.getByText(`Uloženo: ${NAME},`)).toBeVisible();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(page.getByText("0 ks", { exact: true })).toBeVisible();
  const saved = await database.db
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        eq(reservation.customerName, NAME),
        eq(reservation.pickupDate, tomorrow),
        eq(reservation.source, "phone"),
      ),
    );
  expect(saved.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Zobrazit den" }).click();
  await expect(page).toHaveURL(new RegExp(`/dnes\\?den=${tomorrow}$`));
  await expect(
    orderCard(page, NAME).filter({ hasText: "2× Rohlík" }),
  ).toBeVisible();
});

test("lists what is missing and starts a new customer", async ({ page }) => {
  await page.goto("/nova");
  await page.getByRole("button", { name: "Uložit rezervaci" }).click();
  const summary = page.getByRole("heading", { name: "Rezervaci nejde uložit" });
  await expect(summary).toBeVisible();
  for (const text of [
    "Vyberte zákazníka nebo zadejte nového.",
    "Vyberte den vyzvednutí.",
    "Vyberte aspoň jeden výrobek.",
  ]) {
    await expect(page.getByRole("link", { name: text })).toBeVisible();
  }

  // A number nobody has: "Nový zákazník" keeps it.
  const search = page.getByRole("combobox", { name: "Zákazník" });
  await search.fill("603 111 222");
  await page.getByRole("option", { name: "Nový zákazník" }).click();
  await expect(page.getByLabel("Telefon")).toHaveValue("603 111 222");
  await expect(page.getByLabel("Jméno")).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Vyberte zákazníka nebo zadejte nového." }),
  ).toHaveCount(0);
});
