// "Trvalé objednávky" (R7): the owner adds, edits and ends a regular
// customer's weekly order; staff cannot get in.
import { expect, type Page, test } from "@playwright/test";
import { and, eq, gte } from "drizzle-orm";
import {
  customer,
  product,
  reservation,
  reservationItem,
  standingOrder,
} from "../src/lib/db/schema";
import { firstOpenDay } from "../src/lib/domain/standing-orders";
import { addDays, weekdayOf } from "../src/lib/domain/time";
import { cutoffTime } from "../src/lib/services/settings";
import { OWNER_SESSION } from "./env";
import { openDb, orderCard, resetData } from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));

// Tablet landscape, the tablet by the phone.
test.use({ viewport: { width: 1180, height: 820 } });

const NEW_CUSTOMER = "Školní jídelna";
const REGULAR = "Kavárna U Mostu";

/** The first day an edit changes, and the first weekday (Po–Pá) from it. */
async function openDays() {
  const from = firstOpenDay(
    Temporal.Now.instant(),
    await cutoffTime(database.db),
  );
  let weekday = from;
  while (weekdayOf(weekday) > 5) weekday = addDays(weekday, 1);
  return { from, weekday };
}

/** Rohlík pieces on a customer's standing order days, by date. */
async function rohlikDays(customerName: string) {
  const rows = await database.db
    .select({
      date: reservation.pickupDate,
      status: reservation.status,
      quantity: reservationItem.quantity,
    })
    .from(reservation)
    .innerJoin(
      reservationItem,
      eq(reservationItem.reservationId, reservation.id),
    )
    .innerJoin(product, eq(product.id, reservationItem.productId))
    .where(
      and(
        eq(reservation.customerName, customerName),
        eq(reservation.source, "standing_order"),
        eq(product.name, "Rohlík"),
      ),
    );
  return rows.toSorted((a, b) => a.date.localeCompare(b.date));
}

/** "Trvalé" of Rohlík in the bake plan of a day. */
async function plannedStanding(page: Page, date: string) {
  await page.goto(`/plan?den=${date}`);
  const row = page.getByRole("row").filter({
    has: page.getByRole("rowheader", { name: "Rohlík", exact: true }),
  });
  const text = await row
    .getByRole("cell")
    .nth(1)
    .locator(".sr-only")
    .first()
    .textContent();
  return Number(text);
}

test.describe("staff", () => {
  test("do not see the item and /trvale goes to /dnes", async ({ page }) => {
    await page.goto("/dnes");
    const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
    await expect(nav.getByRole("link", { name: "Dnes" })).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Trvalé objednávky" }),
    ).toHaveCount(0);
    await page.goto("/trvale");
    await expect(page).toHaveURL(/\/dnes$/);
  });
});

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/trvale goes to the login", async ({ page }) => {
    await page.goto("/trvale");
    await expect(page).toHaveURL(/\/prihlaseni/);
  });
});

test.describe("owner", () => {
  test.use({ storageState: OWNER_SESSION });

  test("adds a standing order for a new customer", async ({ page }) => {
    const { weekday } = await openDays();
    const before = await plannedStanding(page, weekday);

    await page.goto("/dnes");
    await page
      .getByRole("navigation", { name: "Hlavní navigace" })
      .getByRole("link", { name: "Trvalé objednávky" })
      .click();
    await expect(page).toHaveURL(/\/trvale$/);

    await page
      .getByRole("button", { name: "Přidat trvalou objednávku" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Nová trvalá objednávka",
    });
    const search = dialog.getByRole("combobox", { name: "Zákazník" });
    await search.fill(NEW_CUSTOMER);
    await dialog.getByRole("option", { name: "Nový zákazník" }).click();
    await expect(dialog.getByLabel("Jméno")).toHaveValue(NEW_CUSTOMER);
    await dialog.getByLabel("Telefon").fill("777 000 401");
    for (const day of ["Po", "Út", "St", "Čt", "Pá"]) {
      await dialog.getByText(day, { exact: true }).click();
    }
    await dialog
      .getByRole("spinbutton", { name: "Rohlík, počet kusů" })
      .fill("10");
    await dialog.getByRole("button", { name: "Uložit" }).click();

    await expect(page.getByText(`Uloženo: ${NEW_CUSTOMER}`)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole("button", { name: new RegExp(NEW_CUSTOMER) });
    await expect(row).toContainText("Po Út St Čt Pá");
    await expect(row).toContainText("Rohlík 10 ks");

    expect(await plannedStanding(page, weekday)).toBe(before + 10);
    await page.goto(`/dnes?den=${weekday}`);
    const card = orderCard(page, NEW_CUSTOMER);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Trvalá");
  });

  test("edits a standing order from the first open day on", async ({
    page,
  }) => {
    const { from } = await openDays();
    const before = await rohlikDays(REGULAR);
    expect(before.length).toBeGreaterThan(0);

    await page.goto("/trvale");
    await page.getByRole("button", { name: new RegExp(REGULAR) }).click();
    const dialog = page.getByRole("dialog", {
      name: "Upravit trvalou objednávku",
    });
    await expect(dialog).toContainText("Změny platí od");
    const rohlik = dialog.getByRole("spinbutton", {
      name: "Rohlík, počet kusů",
    });
    await expect(rohlik).toHaveValue("40");
    await rohlik.fill("45");
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(`Uloženo: ${REGULAR}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(REGULAR) }),
    ).toContainText("Rohlík 45 ks");

    const after = await rohlikDays(REGULAR);
    for (const day of after) {
      expect(day.quantity, day.date).toBe(day.date < from ? 40 : 45);
    }
    // Days before the first open day are the same as before the edit.
    expect(after.filter((d) => d.date < from)).toEqual(
      before.filter((d) => d.date < from),
    );
    expect(after.some((d) => d.date >= from)).toBe(true);
  });

  test("ends a standing order and uses it again", async ({ page }) => {
    const { from } = await openDays();
    await page.goto("/trvale");
    await page.getByRole("button", { name: new RegExp(REGULAR) }).click();
    const dialog = page.getByRole("dialog", {
      name: "Upravit trvalou objednávku",
    });
    await dialog.getByRole("button", { name: "Ukončit objednávku" }).click();

    const confirm = page.getByRole("dialog", {
      name: "Ukončit trvalou objednávku?",
    });
    await expect(confirm).toContainText(
      `${REGULAR} přestane dostávat objednávky od`,
    );
    // The safe choice has the focus, not the end.
    await expect(
      confirm.getByRole("button", { name: "Ponechat" }),
    ).toBeFocused();
    await confirm.getByRole("button", { name: "Ukončit objednávku" }).click();

    await expect(page.getByText(`Ukončeno: ${REGULAR}`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const ended = page.getByRole("button", { name: new RegExp(REGULAR) });
    await expect(ended).toContainText("Ukončená");

    const templates = await database.db
      .select({ active: standingOrder.active })
      .from(standingOrder)
      .innerJoin(customer, eq(customer.id, standingOrder.customerId))
      .where(eq(customer.name, REGULAR));
    expect(templates).toEqual([{ active: false }]);
    const open = await database.db
      .select({ id: reservation.id })
      .from(reservation)
      .where(
        and(
          eq(reservation.customerName, REGULAR),
          eq(reservation.status, "reserved"),
          gte(reservation.pickupDate, from),
        ),
      );
    expect(open).toEqual([]);

    // "Použít znovu" starts a new order from the ended one.
    await ended.click();
    const view = page.getByRole("dialog", {
      name: "Ukončená trvalá objednávka",
    });
    await view.getByRole("button", { name: "Použít znovu" }).click();
    const reuse = page.getByRole("dialog", { name: "Nová trvalá objednávka" });
    await expect(reuse.getByLabel("Jméno")).toHaveValue(REGULAR);
    await expect(
      reuse.getByRole("spinbutton", { name: "Rohlík, počet kusů" }),
    ).toHaveValue("40");
    await reuse.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(`Uloženo: ${REGULAR}`)).toBeVisible();
    await expect(
      page.getByRole("button", { name: new RegExp(REGULAR) }),
    ).toHaveCount(2);
  });

  test("asks for a weekday next to the days", async ({ page }) => {
    await page.goto("/trvale");
    await page
      .getByRole("button", { name: "Přidat trvalou objednávku" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Nová trvalá objednávka",
    });
    const search = dialog.getByRole("combobox", { name: "Zákazník" });
    await search.fill("777 000 102");
    await dialog.getByRole("option", { name: /MŠ Sluníčko/ }).click();
    await dialog
      .getByRole("spinbutton", { name: "Rohlík, počet kusů" })
      .fill("5");
    await dialog.getByRole("button", { name: "Uložit" }).click();

    const days = dialog.getByRole("group", { name: "Dny vyzvednutí" });
    await expect(days).toContainText("Vyberte aspoň jeden den vyzvednutí.");
    await expect(days.getByRole("checkbox", { name: "Po" })).toBeFocused();
  });
});
