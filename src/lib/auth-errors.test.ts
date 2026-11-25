import { describe, expect, it } from "vitest";
import { signInErrorMessage } from "./auth-errors";

const WRONG = "E-mail nebo heslo nesouhlasí.";
const GENERIC = "Přihlášení se nepovedlo. Zkuste to znovu.";

describe("signInErrorMessage", () => {
  it("says wrong credentials for a wrong password or an unknown e-mail", () => {
    expect(
      signInErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }),
    ).toBe(WRONG);
    expect(signInErrorMessage({ status: 401 })).toBe(WRONG);
  });

  it("does not blame the password when the request itself is rejected", () => {
    expect(signInErrorMessage({ code: "INVALID_ORIGIN", status: 403 })).toBe(
      GENERIC,
    );
    expect(signInErrorMessage({ status: 403 })).toBe(GENERIC);
  });

  it("tells the user to wait when rate limited", () => {
    expect(signInErrorMessage({ status: 429 })).toMatch(/Příliš mnoho pokusů/);
  });

  it("explains a banned account", () => {
    expect(signInErrorMessage({ code: "BANNED_USER", status: 403 })).toMatch(
      /zablokovaný/,
    );
  });

  it("ignores codes that only exist on Object.prototype", () => {
    expect(signInErrorMessage({ code: "toString", status: 500 })).toBe(GENERIC);
  });

  it("falls back to a generic message", () => {
    expect(signInErrorMessage({ status: 500 })).toBe(GENERIC);
  });
});
