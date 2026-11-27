import { describe, expect, it } from "vitest";
import { productInput } from "@/lib/validators/product";
import {
  cutoffSavedMessage,
  FIELD_MESSAGE,
  formatBakeDays,
  issueMessages,
  NAME_TOO_LONG,
  PRICE_TOO_HIGH,
} from "./messages";

const valid = {
  name: "Rohlík",
  price: "4,50",
  dailyLimit: "300",
  buffer: "40",
  bakeDays: [1],
  active: true,
};

function messagesFor(input: unknown) {
  const parsed = productInput.safeParse(input);
  if (parsed.success) throw new Error("Expected invalid input");
  return issueMessages(parsed.error.issues);
}

describe("issueMessages", () => {
  it("maps an empty form to a message per field", () => {
    expect(
      messagesFor({
        name: "",
        price: "",
        dailyLimit: "",
        buffer: "",
        bakeDays: [],
        active: true,
      }),
    ).toEqual(FIELD_MESSAGE);
  });

  it("says when the name is too long or the price too high", () => {
    expect(
      messagesFor({ ...valid, name: "x".repeat(61), price: "200 000" }),
    ).toEqual({ name: NAME_TOO_LONG, price: PRICE_TOO_HIGH });
  });

  it("asks for a price in crowns for a wrong format", () => {
    expect(messagesFor({ ...valid, price: "45,505" })).toEqual({
      price: FIELD_MESSAGE.price,
    });
  });
});

describe("formatBakeDays", () => {
  it("lists the days from Monday", () => {
    expect(formatBakeDays([6, 1, 2])).toBe("Po Út So");
  });

  it("says every day for all seven", () => {
    expect(formatBakeDays([7, 1, 2, 3, 4, 5, 6])).toBe("Každý den");
  });
});

describe("cutoffSavedMessage", () => {
  it("says when tomorrow just closed", () => {
    expect(cutoffSavedMessage("17:00", true)).toBe(
      "Uzávěrka je teď v 17:00. Na zítra už nejde objednat.",
    );
    expect(cutoffSavedMessage("19:00", false)).toBe("Uzávěrka je teď v 19:00.");
  });
});
