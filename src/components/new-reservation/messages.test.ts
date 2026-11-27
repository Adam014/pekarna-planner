import { describe, expect, it } from "vitest";
import { phoneReservationInput } from "@/lib/validators/reservation";
import {
  FIELD_MESSAGE,
  issueMessages,
  notBakedMessage,
  REJECTED_MESSAGE,
  savedMessage,
  soldOutMessage,
} from "./messages";

const valid = {
  customerName: "Jana Nováková",
  phone: "601 234 567",
  pickupDate: "2026-11-28",
  items: [{ productId: crypto.randomUUID(), quantity: 2 }],
  idempotencyKey: crypto.randomUUID(),
};

function messagesFor(input: unknown) {
  const parsed = phoneReservationInput.safeParse(input);
  if (parsed.success) throw new Error("Expected invalid input");
  return issueMessages(parsed.error.issues);
}

describe("issueMessages", () => {
  it("maps an empty form to a message per field", () => {
    expect(
      messagesFor({ ...valid, customerName: " ", pickupDate: "", items: [] }),
    ).toEqual({
      customerName: "Zadejte jméno zákazníka.",
      pickupDate: "Vyberte den vyzvednutí.",
      items: "Vyberte aspoň jeden výrobek.",
    });
  });

  it("maps a wrong time and a long note", () => {
    expect(
      messagesFor({ ...valid, pickupTime: "25:00", note: "x".repeat(501) }),
    ).toEqual({
      pickupTime: FIELD_MESSAGE.pickupTime,
      note: FIELD_MESSAGE.note,
    });
  });

  it("ignores fields the form does not show", () => {
    expect(messagesFor({ ...valid, idempotencyKey: "x" })).toEqual({});
  });
});

describe("result messages", () => {
  it("says how many are left, or that the day is sold out", () => {
    expect(soldOutMessage(8)).toBe("Zbývá jen 8 ks.");
    expect(soldOutMessage(0)).toBe("Na tento den je vyprodáno.");
  });

  it("names the products and the day that is not baked", () => {
    expect(notBakedMessage(["Koláč tvarohový"], 6)).toBe(
      "Koláč tvarohový se v sobotu nepeče. Uložit i tak?",
    );
    expect(notBakedMessage(["Vánočka", "Chléb"], 3)).toBe(
      "Vánočka, Chléb se ve středu nepečou. Uložit i tak?",
    );
  });

  it("explains every refusal", () => {
    expect(REJECTED_MESSAGE).toEqual({
      day_not_bookable: "Vyberte den od dneška do 21 dní.",
      catalog_changed: "Nabídka se mezitím změnila. Zkontrolujte výrobky.",
      idempotency_conflict: "Tahle rezervace už je uložená. Začněte novou.",
    });
  });

  it("sums up the saved order", () => {
    expect(savedMessage("Jana Nováková", "pátek 28. 11.", 6)).toBe(
      "Uloženo: Jana Nováková, pátek 28. 11., 6 ks",
    );
  });
});
