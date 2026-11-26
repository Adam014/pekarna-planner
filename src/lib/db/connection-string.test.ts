import { describe, expect, it } from "vitest";
import { withVerifiedTls } from "./connection-string";

describe("withVerifiedTls", () => {
  it.each([
    [
      "postgres://u:p@h/db?sslmode=require",
      "postgres://u:p@h/db?sslmode=verify-full",
    ],
    [
      "postgres://u:p@h/db?sslmode=require&channel_binding=require",
      "postgres://u:p@h/db?sslmode=verify-full&channel_binding=require",
    ],
    [
      "postgres://u:p@h/db?a=1&sslmode=prefer",
      "postgres://u:p@h/db?a=1&sslmode=verify-full",
    ],
  ])("asks for full verification: %s", (url, expected) => {
    expect(withVerifiedTls(url)).toBe(expected);
  });

  it("changes every sslmode, as pg reads the last one", () => {
    expect(
      withVerifiedTls("postgres://h/db?sslmode=require&sslmode=prefer"),
    ).toBe("postgres://h/db?sslmode=verify-full&sslmode=verify-full");
  });

  it.each([
    "postgres://u:p@h/db?uselibpqcompat=true&sslmode=require",
    "postgres://pekarna:pekarna@localhost:5432/pekarna",
    "postgres://u:p@h/db?sslmode=verify-full",
    "postgres://u:p@h/db?sslmode=disable",
  ])("leaves %s as it is", (url) => {
    expect(withVerifiedTls(url)).toBe(url);
  });
});
