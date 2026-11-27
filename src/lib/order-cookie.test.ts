import { describe, expect, it } from "vitest";
import { MAX_REMEMBERED, parseTokens, withToken } from "./order-cookie";

const a = "a".repeat(43);
const b = "b".repeat(43);
const c = "c".repeat(43);
const d = "d".repeat(43);
const e = "e".repeat(43);
const f = "f".repeat(43);

describe("parseTokens", () => {
  it("is empty without a cookie", () => {
    expect(parseTokens(undefined)).toEqual([]);
    expect(parseTokens("")).toEqual([]);
  });

  it("drops anything not shaped like a token", () => {
    expect(parseTokens(`${a}.junk.${b}..${"x".repeat(44)}.${c}=`)).toEqual([
      a,
      b,
    ]);
  });

  it("keeps the first of duplicates and at most five", () => {
    expect(parseTokens([a, b, a, c, d, e, f].join("."))).toEqual([
      a,
      b,
      c,
      d,
      e,
    ]);
  });
});

describe("withToken", () => {
  it("puts the new token first", () => {
    expect(withToken([a, b], c)).toEqual([c, a, b]);
  });

  it("moves a known token to the front instead of repeating it", () => {
    expect(withToken([a, b, c], b)).toEqual([b, a, c]);
  });

  it("drops the oldest above the cap", () => {
    const full = [a, b, c, d, e];
    expect(full).toHaveLength(MAX_REMEMBERED);
    expect(withToken(full, f)).toEqual([f, a, b, c, d]);
  });
});
