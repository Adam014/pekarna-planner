// "Výrobky" (R6): the owner keeps the catalogue; staff cannot get in.
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { product } from "../src/lib/db/schema";
import { OWNER_SESSION } from "./env";
import { openDb, resetData } from "./fixtures";

const database = openDb();
test.afterAll(() => database.pool.end());
test.beforeEach(() => resetData(database));

// Tablet landscape, the tablet by the phone.
test.use({ viewport: { width: 1180, height: 820 } });

const NAME = "Žitný chléb";

test.describe("staff", () => {
  test("do not see the item and /vyrobky goes to /dnes", async ({ page }) => {
    await page.goto("/dnes");
    const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
    await expect(nav.getByRole("link", { name: "Dnes" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Výrobky" })).toHaveCount(0);
    await page.goto("/vyrobky");
    await expect(page).toHaveURL(/\/dnes$/);
  });
});

test.describe("owner", () => {
  test.use({ storageState: OWNER_SESSION });

  test("adds a product, edits it and takes it off the offer", async ({
    page,
  }) => {
    await page.goto("/dnes");
    await page
      .getByRole("navigation", { name: "Hlavní navigace" })
      .getByRole("link", { name: "Výrobky" })
      .click();
    await expect(page).toHaveURL(/\/vyrobky$/);

    await page.getByRole("button", { name: "Přidat výrobek" }).click();
    const dialog = page.getByRole("dialog", { name: "Nový výrobek" });
    await dialog.getByLabel("Název").fill(NAME);
    await dialog.getByLabel("Cena za kus").fill("45,50");
    await dialog.getByLabel("Denní limit").fill("20");
    for (const day of ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]) {
      await dialog.getByText(day, { exact: true }).click();
    }
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(page.getByText(`Uloženo: ${NAME}`)).toBeVisible();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole("button", { name: new RegExp(NAME) });
    await expect(row).toContainText("45,50 Kč · limit 20 ks · rezerva 0 ks");
    await expect(row).toContainText("Každý den");

    await page.goto("/nova");
    await expect(
      page.getByRole("button", { name: `Přidat ${NAME}` }),
    ).toBeVisible();

    // A wrong price stays in the field with the error next to it.
    await page.goto("/vyrobky");
    await page.getByRole("button", { name: new RegExp(NAME) }).click();
    const edit = page.getByRole("dialog", { name: "Upravit výrobek" });
    const price = edit.getByLabel("Cena za kus");
    await expect(price).toHaveValue("45,50");
    await price.fill("45,505");
    await edit.getByRole("button", { name: "Uložit" }).click();
    await expect(
      edit.getByText("Zadejte cenu v korunách, třeba 45 nebo 45,50."),
    ).toBeVisible();
    await expect(price).toHaveValue("45,505");
    await expect(price).toBeFocused();

    await price.fill("49");
    await edit.getByLabel("V nabídce").uncheck();
    await edit.getByRole("button", { name: "Uložit" }).click();
    await expect(edit).toHaveCount(0);
    const changed = page.getByRole("button", { name: new RegExp(NAME) });
    await expect(changed).toContainText("49 Kč");
    await expect(changed).toContainText("Mimo nabídku");
    const [saved] = await database.db
      .select({ price: product.price, active: product.active })
      .from(product)
      .where(eq(product.name, NAME));
    expect(saved).toEqual({ price: 4900, active: false });

    await page.goto("/nova");
    await expect(
      page.getByRole("button", { name: "Přidat Rohlík" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Přidat ${NAME}` }),
    ).toHaveCount(0);
  });

  test("refuses a name another product has", async ({ page }) => {
    await page.goto("/vyrobky");
    await page.getByRole("button", { name: "Přidat výrobek" }).click();
    const dialog = page.getByRole("dialog", { name: "Nový výrobek" });
    await dialog.getByLabel("Název").fill(" rohlík ");
    await dialog.getByLabel("Cena za kus").fill("5");
    await dialog.getByLabel("Denní limit").fill("10");
    await dialog.getByText("Po", { exact: true }).click();
    await dialog.getByRole("button", { name: "Uložit" }).click();
    await expect(
      dialog.getByText("Výrobek s tímto názvem už existuje."),
    ).toBeVisible();
  });
});
