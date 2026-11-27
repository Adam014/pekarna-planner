import { describe, expect, it } from "vitest";
import { standingOrderFormInput } from "@/lib/validators/reservation";
import {
  appliesFromMessage,
  endConfirmMessage,
  FIELD_MESSAGE,
  formatTime,
  inactiveNotice,
  issueMessages,
  notBakedHint,
  notBakedSaved,
  skippedDays,
  skippedMessage,
  skippedSummary,
} from "./messages";

function messagesFor(input: unknown) {
  const parsed = standingOrderFormInput.safeParse(input);
  if (parsed.success) throw new Error("Expected invalid input");
  return issueMessages(parsed.error.issues);
}

describe("issueMessages", () => {
  it("maps an empty form to a message per field", () => {
    // "customer" is the search; the form maps name and phone to it.
    const fields = Object.fromEntries(
      Object.entries(FIELD_MESSAGE).filter(([key]) => key !== "customer"),
    );
    expect(
      messagesFor({
        customerName: "",
        phone: 1,
        weekdays: [],
        pickupTime: "7",
        note: "x".repeat(501),
        items: [],
      }),
    ).toEqual(fields);
  });

  it("ignores fields the form does not have", () => {
    expect(issueMessages([{ path: ["id"] }])).toEqual({});
  });
});

describe("skipped days", () => {
  it("says how many pieces are left, or that none are", () => {
    expect(skippedMessage("Chléb", 5)).toBe("Chléb, zbývá 5 ks");
    expect(skippedMessage("Chléb", 0)).toBe("Chléb, už nic nezbývá");
  });

  it("lists each day once, in date order", () => {
    expect(
      skippedDays([
        { date: "2026-12-08", productName: "Chléb", remaining: 0 },
        { date: "2026-12-01", productName: "Chléb", remaining: 5 },
        { date: "2026-12-01", productName: "Rohlík", remaining: 2 },
      ]),
    ).toEqual([
      "út 1. 12. (Chléb, zbývá 5 ks; Rohlík, zbývá 2 ks)",
      "út 8. 12. (Chléb, už nic nezbývá)",
    ]);
  });

  it("counts the days in Czech", () => {
    expect(skippedSummary(["a"])).toBe("1 den se nevešel do limitu: a");
    expect(skippedSummary(["a", "b"])).toBe("2 dny se nevešly do limitu: a, b");
    expect(skippedSummary(["a", "b", "c", "d", "e"])).toBe(
      "5 dní se nevešlo do limitu: a, b, c, d, e",
    );
  });
});

describe("dates", () => {
  it("says from which day an edit applies", () => {
    expect(appliesFromMessage("2026-11-27")).toBe(
      "Změny platí od pátku 27. listopadu. Dny před tím zůstanou, jak jsou.",
    );
  });

  it("mentions tomorrow's day only when it stays", () => {
    expect(endConfirmMessage("Kavárna", "pátku 27. listopadu", false)).toBe(
      "Kavárna přestane dostávat objednávky od pátku 27. listopadu.",
    );
    expect(
      endConfirmMessage("Kavárna", "soboty 28. listopadu", true),
    ).toContain("Zítřejší objednávka už je po uzávěrce a zůstane");
  });

  it("shows the time without a leading zero", () => {
    expect(formatTime("06:45")).toBe("6:45");
    expect(formatTime("10:00")).toBe("10:00");
  });
});

describe("products", () => {
  it("names the days a product is not baked", () => {
    expect(notBakedHint([6])).toBe(
      "V sobotu se nepeče, ten den v objednávce nebude.",
    );
    expect(notBakedHint([5, 6, 7])).toBe(
      "V pátek, v sobotu a v neděli se nepeče, ty dny v objednávce nebude.",
    );
    expect(notBakedSaved("Makové buchty", [5])).toBe(
      "V pátek se nepeče: Makové buchty.",
    );
  });

  it("says which products are off the offer", () => {
    expect(inactiveNotice(["Croissant"])).toBe(
      "Už není v nabídce: Croissant. Uložením se z objednávky odebere.",
    );
    expect(inactiveNotice(["Croissant", "Bageta"])).toBe(
      "Už nejsou v nabídce: Croissant, Bageta. Uložením se z objednávky odeberou.",
    );
  });
});
