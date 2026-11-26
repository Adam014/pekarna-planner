// "Dnes" (R5): hand out today's orders, undo a wrong mark, switch days.
import { expect, test } from "@playwright/test";
import {
  CUSTOMER,
  openDb,
  orderCard,
  orderStatus,
  resetData,
} from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));

test.describe("without a session", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Dnes goes to the login", async ({ page }) => {
    await page.goto("/dnes");
    await expect(page).toHaveURL(/\/prihlaseni/);
  });
});

test("marks an order picked up and undoes it from the toast", async ({
  page,
}) => {
  await page.goto("/dnes");
  const card = orderCard(page, CUSTOMER);
  await card.getByRole("button", { name: "Vydáno", exact: true }).click();

  const handled = page.getByRole("region", { name: "Vyřízené" });
  await expect(handled.getByText(CUSTOMER, { exact: true })).toBeVisible();
  await expect(page.getByText(`${CUSTOMER}: vydáno`)).toBeVisible();
  await expect.poll(() => orderStatus(database)).toBe("picked_up");

  await page.getByRole("button", { name: "Zpět" }).click();
  const waiting = page.getByRole("region", { name: "K výdeji" });
  await expect(waiting.getByText(CUSTOMER, { exact: true })).toBeVisible();
  await expect.poll(() => orderStatus(database)).toBe("reserved");
});

test("marks a no-show from the menu and puts it back from the row", async ({
  page,
}) => {
  await page.goto("/dnes");
  await orderCard(page, CUSTOMER)
    .getByRole("button", { name: `Další akce: ${CUSTOMER}` })
    .click();
  await page.getByRole("menuitem", { name: "Nevyzvednuto" }).click();
  await expect.poll(() => orderStatus(database)).toBe("no_show");

  await orderCard(page, CUSTOMER)
    .getByRole("button", { name: "Vrátit" })
    .click();
  await expect.poll(() => orderStatus(database)).toBe("reserved");
});

test("cancels an order from the menu", async ({ page }) => {
  await page.goto("/dnes");
  await orderCard(page, CUSTOMER)
    .getByRole("button", { name: `Další akce: ${CUSTOMER}` })
    .click();
  await page.getByRole("menuitem", { name: "Zrušit objednávku" }).click();

  const handled = page.getByRole("region", { name: "Vyřízené" });
  await expect(handled.getByText(CUSTOMER, { exact: true })).toBeVisible();
  await expect(page.getByText(`${CUSTOMER}: zrušeno`)).toBeVisible();
  await expect.poll(() => orderStatus(database)).toBe("cancelled");
});

test("finds an order by name without diacritics and by phone", async ({
  page,
}) => {
  await page.goto("/dnes");
  const search = page.getByRole("searchbox", { name: /hledat/i });
  await search.fill("zkouska vydeje");
  await expect(orderCard(page, CUSTOMER)).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Kč" }),
  ).toHaveCount(1);
  await search.fill("777 000 299");
  await expect(orderCard(page, CUSTOMER)).toBeVisible();
  await search.fill("nikdo takový");
  await expect(page.getByText("Hledání nic nenašlo.")).toBeVisible();
});

test("switches to the next day and back to today", async ({ page }) => {
  await page.goto("/dnes");
  await page.getByRole("button", { name: "Další den" }).click();
  await expect(page).toHaveURL(/\?den=\d{4}-\d{2}-\d{2}$/);
  await expect(orderCard(page, CUSTOMER)).toHaveCount(0);

  await page.getByRole("button", { name: "Dnes" }).click();
  await expect(page).toHaveURL(/\/dnes$/);
  await expect(orderCard(page, CUSTOMER)).toBeVisible();
});

test("a server action call without a session changes nothing", async ({
  page,
  playwright,
}) => {
  await page.goto("/dnes");
  // Capture a real action request, then undo what it did.
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  await orderCard(page, CUSTOMER)
    .getByRole("button", { name: "Vydáno", exact: true })
    .click();
  const action = await request;
  const headers = await action.allHeaders();
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect.poll(() => orderStatus(database)).toBe("reserved");

  // Replay it without the cookie. Posted to "/", which the proxy does not
  // guard, so only requireUser() in the action stands in the way. The empty
  // storage state matters: request contexts inherit the staff session.
  delete headers.cookie;
  const anonymous = await playwright.request.newContext({
    storageState: { cookies: [], origins: [] },
  });
  await anonymous.post(new URL("/", action.url()).href, {
    headers,
    data: action.postDataBuffer() ?? undefined,
    maxRedirects: 0,
  });
  await anonymous.dispose();
  expect(await orderStatus(database)).toBe("reserved");
});
