import { describe, expect, it } from "vitest";
import { changedMessage, refusalMessage } from "./messages";

describe("changedMessage", () => {
  it("names the new status, and says when an order went back", () => {
    expect(changedMessage("Jana", "no_show")).toBe("Jana: nevyzvednuto");
    expect(changedMessage("Jana", "reserved")).toBe("Jana: vráceno k výdeji");
  });
});

describe("refusalMessage", () => {
  it("is null for a saved change", () => {
    expect(refusalMessage({ status: "updated" })).toBeNull();
  });

  it("lists every product over the limit", () => {
    expect(
      refusalMessage({ status: "sold_out", products: ["Rohlík", "Chléb"] }),
    ).toBe("Nejde vrátit, denní limit je vyčerpaný: Rohlík, Chléb.");
  });

  it.each(["too_early", "changed", "not_found", "invalid"] as const)(
    "explains %s",
    (status) => expect(refusalMessage({ status })).toMatch(/\.$/),
  );
});
