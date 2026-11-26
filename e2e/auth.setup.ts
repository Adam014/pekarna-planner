// Signs in once and saves the session for the tests: the app limits sign-in
// attempts, so signing in before every test would hit the limit.
// https://playwright.dev/docs/auth
import { expect, test as setup } from "@playwright/test";
import { STAFF, STAFF_SESSION } from "./env";

setup("sign in as staff", async ({ page }) => {
  await page.goto("/prihlaseni");
  await page.getByLabel(/e-mail/i).fill(STAFF.email);
  await page.getByLabel(/heslo/i).fill(STAFF.password);
  await page.getByRole("button", { name: /přihlásit/i }).click();
  await expect(page).toHaveURL(/\/dnes$/);
  await page.context().storageState({ path: STAFF_SESSION });
});
