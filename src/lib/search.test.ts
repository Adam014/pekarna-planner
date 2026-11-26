import { describe, expect, it } from "vitest";
import { fold, matchesCustomer } from "./search";

const jana = { name: "Jana Dvořáková", phone: "+420601234567" };

describe("fold", () => {
  it("drops diacritics, case and extra spaces", () => {
    expect(fold("  Jana   DVOŘÁKOVÁ ")).toBe("jana dvorakova");
  });
});

describe("matchesCustomer", () => {
  it.each(["", "dvo", "dvorakova", "Jana  Dvořáková", "DVOŘ"])(
    "finds by name: %j",
    (query) => expect(matchesCustomer(jana, query)).toBe(true),
  );

  it.each(["601", "601 234 567", "+420 601 234 567", "00420601234567"])(
    "finds by phone as typed or pasted: %j",
    (query) => expect(matchesCustomer(jana, query)).toBe(true),
  );

  it.each(["Petr", "60", "602", "Jana 999"])("does not match %j", (query) =>
    expect(matchesCustomer(jana, query)).toBe(false),
  );
});
