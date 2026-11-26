import { describe, expect, it } from "vitest";
import { cronSecret, isScheduledRequest } from "./cron-auth";

const SECRET = "a-random-secret-of-32-characters";

describe("isScheduledRequest", () => {
  it("lets in the right secret", () => {
    expect(isScheduledRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    ["no header", null],
    ["a wrong secret", "Bearer a-random-secret-of-32-characterz"],
    ["the secret without Bearer", SECRET],
    ["an empty bearer", "Bearer "],
  ])("refuses %s", (_, header) => {
    expect(isScheduledRequest(header, SECRET)).toBe(false);
  });

  it("refuses everything without a usable secret", () => {
    expect(isScheduledRequest("Bearer ", null)).toBe(false);
    expect(isScheduledRequest("Bearer null", null)).toBe(false);
  });
});

describe("cronSecret", () => {
  it("takes 16 characters or more, without a trailing newline", () => {
    expect(cronSecret("a".repeat(16))).toBe("a".repeat(16));
    expect(cronSecret(`${SECRET}\n`)).toBe(SECRET);
  });

  it.each([undefined, "", "a".repeat(15), `${"a".repeat(15)} \n`])(
    "has none for %j",
    (value) => {
      expect(cronSecret(value)).toBeNull();
    },
  );
});
