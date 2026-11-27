import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { orderToken } from "./order-token";

describe("orderToken", () => {
  it("accepts a token as the service makes it", () => {
    const token = randomBytes(32).toString("base64url");
    expect(orderToken.safeParse(token).success).toBe(true);
  });

  it("refuses a wrong length or other characters", () => {
    const valid = "a".repeat(43);
    for (const value of [
      "",
      valid.slice(1),
      `${valid}a`,
      `${valid.slice(1)}=`,
      `${valid.slice(1)}.`,
      `${valid.slice(1)}/`,
      null,
    ]) {
      expect(orderToken.safeParse(value).success).toBe(false);
    }
  });
});
