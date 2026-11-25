import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it.each([
    "601234567",
    "601 234 567",
    "601-234-567",
    "+420 601 234 567",
    "+420601234567",
    "00420601234567",
    "  601 234 567  ",
    // Pasted from a phone's contacts: direction marks and odd spaces.
    "‪+420 601 234 567‬",
    "601 234 567",
    "601\t234\n567",
  ])("reads %j as a Czech mobile", (input) => {
    expect(normalizePhone(input)).toBe("+420601234567");
  });

  it("accepts a landline", () => {
    expect(normalizePhone("224 123 456")).toBe("+420224123456");
  });

  it("keeps a foreign number written with its country code", () => {
    expect(normalizePhone("+421 905 123 456")).toBe("+421905123456");
  });

  it.each([
    "",
    "   ",
    "60123",
    "6012345678901",
    "abc",
    "601 234 56a",
    "123 456 789", // no Czech number starts with 1
    "600 123 456", // a range not assigned to anyone
  ])("rejects %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("rejects a number inside other text", () => {
    expect(normalizePhone("Petr 601 234 567")).toBeNull();
  });

  it.each(["601 234 567 ext. 12", "601234567 x12", "601234567, 602345678"])(
    "rejects an extension or a second number: %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );

  it.each([
    "900 123 456", // premium rate
    "800 123 456", // toll free
    "972 123 456", // UAN
  ])("rejects a service number nobody answers as a customer: %j", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("rejects a Slovak mobile typed without +421", () => {
    // Read as Czech it is a premium-rate number; the customer must add +421.
    expect(normalizePhone("905 123 456")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("shows a Czech number without the country code", () => {
    expect(formatPhone("+420601234567")).toBe("601 234 567");
  });

  it("shows a foreign number with its country code", () => {
    expect(formatPhone("+421905123456")).toBe("+421 905 123 456");
  });

  it("gives back what normalizePhone reads as the same number", () => {
    for (const e164 of ["+420601234567", "+420224123456", "+421905123456"]) {
      expect(normalizePhone(formatPhone(e164))).toBe(e164);
    }
  });
});
