import { describe, expect, it } from "vitest";
import {
  cutoffInput,
  parsePriceHalere,
  priceInputValue,
  productInput,
} from "./product";

describe("parsePriceHalere", () => {
  it.each([
    ["45", 4500],
    ["45,50", 4550],
    ["45.5", 4550],
    ["1 200", 120_000],
    ["1 200,05", 120_005],
    [" 0 ", 0],
    ["100000", 10_000_000],
  ])("reads %j as %i haléřů", (text, halere) => {
    expect(parsePriceHalere(text)).toBe(halere);
  });

  it.each(["45,505", "-1", "abc", "", "45,", ",5", "4 5", "1e3", "12 34"])(
    "refuses %j",
    (text) => {
      expect(parsePriceHalere(text)).toBeNull();
    },
  );
});

describe("priceInputValue", () => {
  it("shows whole crowns without decimals and the rest with two", () => {
    expect(priceInputValue(4500)).toBe("45");
    expect(priceInputValue(4550)).toBe("45,50");
    expect(priceInputValue(4505)).toBe("45,05");
    expect(priceInputValue(0)).toBe("0");
  });

  it("round-trips through the parser", () => {
    for (const halere of [0, 5, 4550, 7900, 1_234_567]) {
      expect(parsePriceHalere(priceInputValue(halere))).toBe(halere);
    }
  });
});

const valid = {
  name: "  Kváskový chléb ",
  price: "79",
  dailyLimit: "40",
  buffer: "0",
  bakeDays: [6, 1, 3],
  active: true,
};

describe("productInput", () => {
  it("trims the name, reads numbers and sorts the days", () => {
    expect(productInput.parse(valid)).toEqual({
      name: "Kváskový chléb",
      price: 7900,
      dailyLimit: 40,
      buffer: 0,
      bakeDays: [1, 3, 6],
      active: true,
    });
  });

  it("takes an id only as a uuid", () => {
    const id = crypto.randomUUID();
    expect(productInput.parse({ ...valid, id }).id).toBe(id);
    expect(productInput.safeParse({ ...valid, id: "1" }).success).toBe(false);
  });

  it.each([
    { price: "100000,01" },
    { dailyLimit: "0" },
    { dailyLimit: "1000" },
    { dailyLimit: "4.5" },
    { buffer: "-1" },
    { bakeDays: [] },
    { bakeDays: [8] },
    { bakeDays: [1, 1] },
    { name: " " },
    { name: "x".repeat(61) },
  ])("refuses %j", (change) => {
    expect(productInput.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe("cutoffInput", () => {
  it.each(["00:00", "18:00", "23:59"])("takes %s", (time) => {
    expect(cutoffInput.safeParse({ time }).success).toBe(true);
  });

  it.each(["24:00", "8:00", "18:60", "", "18:00:00"])("refuses %j", (time) => {
    expect(cutoffInput.safeParse({ time }).success).toBe(false);
  });
});
