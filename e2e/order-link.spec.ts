// The customer's order link (R3): the order page, cancelling before the
// cutoff, the remembered orders on "/" and one answer for a bad link.
import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { reservation } from "../src/lib/db/schema";
import { CUSTOMER, openDb, resetData } from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));
// A customer, not staff.
test.use({ storageState: { cookies: [], origins: [] } });

const NAME = "Odkaz Zákaznice";
const COOKIE = "__Host-pekarna-orders";

/** Orders two rohlíky for the first offered day; returns the link path. */
async function order(page: Page, remember: boolean): Promise<string> {
  await page.goto("/");
  const add = page.getByRole("button", { name: "Přidat: Rohlík", exact: true });
  await add.click();
  await add.click();
  await page.getByLabel("Jméno", { exact: true }).fill(NAME);
  await page.getByLabel("Telefon", { exact: true }).fill("601 234 567");
  if (remember) await page.getByLabel(/Zapamatovat si mě/).check();
  await page.getByRole("button", { name: "Odeslat objednávku" }).click();
  await expect(
    page.getByRole("heading", { name: "Objednávka přijata" }),
  ).toBeVisible();
  const link = page.getByRole("link", { name: "Zobrazit objednávku" });
  const path = await link.getAttribute("href");
  expect(path).toMatch(/^\/objednavka\/[\w-]{43}$/);
  return path ?? "";
}

async function savedStatus(): Promise<string | undefined> {
  const [row] = await database.db
    .select({ status: reservation.status })
    .from(reservation)
    .where(eq(reservation.customerName, NAME));
  return row?.status;
}

test("shows the order, cancels it and lists it on the order page", async ({
  page,
  context,
}) => {
  const path = await order(page, true);

  const [cookie] = (await context.cookies()).filter((c) => c.name === COOKIE);
  expect(cookie).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
  });
  expect(cookie?.value).toBe(path.split("/").at(-1));
  // Persistent only because "Zapamatovat si mě" was ticked.
  expect(cookie?.expires).toBeGreaterThan(Date.now() / 1000 + 40 * 86_400);

  await page.getByRole("link", { name: "Zobrazit objednávku" }).click();
  await expect(page).toHaveURL(path);
  await expect(
    page.getByRole("heading", { name: "Vaše objednávka" }),
  ).toBeVisible();
  // Next keeps the previous page hidden in the DOM, so look inside the order.
  const shown = page.getByRole("region", { name: "Objednávka" });
  await expect(shown.getByText("Rezervováno")).toBeVisible();
  await expect(shown.getByText("2× Rohlík")).toBeVisible();
  await expect(page.getByText(NAME)).toHaveCount(0);

  // The page as a full load: headers for a secret URL.
  const direct = await page.request.get(path);
  const headers = direct.headers();
  expect(headers["referrer-policy"]).toBe("no-referrer");
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["cache-control"]).toContain("no-store");

  await shown.getByText("Zrušit objednávku", { exact: true }).click();
  await shown.getByRole("button", { name: "Ano, zrušit objednávku" }).click();
  await expect(shown.getByText("Objednávka je zrušená.")).toBeVisible();
  await expect(shown.getByText("Zrušeno", { exact: true })).toBeVisible();
  expect(await savedStatus()).toBe("cancelled");

  await page.getByRole("button", { name: "Objednat znovu" }).click();
  const mine = page.getByRole("region", { name: "Vaše objednávky" });
  await expect(mine.getByRole("link")).toHaveCount(1);
  await expect(mine.getByText("Zrušeno")).toBeVisible();
  await mine.getByRole("link").click();
  await expect(page).toHaveURL(path);
});

test("keeps the links only for the session without remember", async ({
  page,
  context,
}) => {
  const path = await order(page, false);
  const [cookie] = (await context.cookies()).filter((c) => c.name === COOKIE);
  expect(cookie?.value).toBe(path.split("/").at(-1));
  expect(cookie?.expires).toBe(-1);

  await page.getByRole("button", { name: "Nová objednávka" }).click();
  const mine = page.getByRole("region", { name: "Vaše objednávky" });
  await expect(mine.getByText("Rezervováno")).toBeVisible();
});

test("answers the same for a changed or malformed link", async ({ page }) => {
  const path = await order(page, false);
  const last = path.at(-1) === "A" ? "B" : "A";
  for (const bad of [`${path.slice(0, -1)}${last}`, "/objednavka/nesmysl"]) {
    await page.goto(bad);
    await expect(
      page.getByRole("heading", { name: "Objednávka nenalezena" }),
    ).toBeVisible();
    await expect(
      page.getByText("Odkaz je neplatný, nebo vypršel."),
    ).toBeVisible();
  }
});

test("shows an order after the cutoff without a way to cancel", async ({
  page,
}) => {
  // Today's fixture order, turned into an online order with a known link.
  const token = randomBytes(32).toString("base64url");
  await database.db
    .update(reservation)
    .set({
      source: "online",
      createdByUserId: null,
      accessTokenHash: createHash("sha256").update(token).digest("hex"),
    })
    .where(eq(reservation.customerName, CUSTOMER));

  await page.goto(`/objednavka/${token}`);
  await expect(page.getByText("3× Rohlík")).toBeVisible();
  await expect(page.getByText(/^Na zrušení je už pozdě/)).toBeVisible();
  await expect(
    page.getByText("Zrušit objednávku", { exact: true }),
  ).toHaveCount(0);
});
