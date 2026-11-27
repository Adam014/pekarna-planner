// Signs in once per account and saves the sessions for the tests: the app
// limits sign-in attempts, so signing in before every test would hit the
// limit. https://playwright.dev/docs/auth
import { expect, test as setup } from "@playwright/test";
import { OWNER, OWNER_SESSION, STAFF, STAFF_SESSION } from "./env";

for (const [role, account, path] of [
  ["staff", STAFF, STAFF_SESSION],
  ["owner", OWNER, OWNER_SESSION],
] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/prihlaseni");
    await page.getByLabel(/e-mail/i).fill(account.email);
    await page.getByLabel(/heslo/i).fill(account.password);
    await page.getByRole("button", { name: /přihlásit/i }).click();
    await expect(page).toHaveURL(/\/dnes$/);
    await page.context().storageState({ path });
  });
}
