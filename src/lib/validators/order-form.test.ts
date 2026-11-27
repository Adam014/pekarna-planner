import { describe, expect, it } from "vitest";
import { ORDER_FORM_MESSAGES as M, parseOrderForm } from "./order-form";

const ROHLIK = "0193a4b2-7c1e-7000-8000-000000000001";
const CHLEB = "0193a4b2-7c1e-7000-8000-000000000002";
const KEY = "0193a4b2-7c1e-7000-8000-0000000000ff";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  const all: Record<string, string> = {
    pickupDate: "2026-11-27",
    pickupTime: "",
    customerName: "Jana Nováková",
    phone: "601 234 567",
    website: "",
    idempotencyKey: KEY,
    [`qty.${ROHLIK}`]: "3",
    [`qty.${CHLEB}`]: "",
    ...fields,
  };
  for (const [name, value] of Object.entries(all)) data.append(name, value);
  return data;
}

describe("parseOrderForm", () => {
  it("keeps only products with pieces and no time when empty", () => {
    const result = parseOrderForm(form({ [`qty.${CHLEB}`]: "0" }));
    expect(result).toMatchObject({
      success: true,
      input: {
        customerName: "Jana Nováková",
        phone: "601 234 567",
        pickupDate: "2026-11-27",
        pickupTime: undefined,
        items: [{ productId: ROHLIK, quantity: 3 }],
        idempotencyKey: KEY,
      },
    });
  });

  it("pads a typed time and reads the remember box", () => {
    const result = parseOrderForm(form({ pickupTime: "8:30", remember: "on" }));
    expect(result.success && result.input.pickupTime).toBe("08:30");
    expect(result.values.remember).toBe(true);
  });

  it("reports every problem at once, in Czech", () => {
    const result = parseOrderForm(
      form({
        customerName: "  ",
        phone: "",
        pickupTime: "25:00",
        [`qty.${ROHLIK}`]: "",
      }),
    );
    expect(result).toMatchObject({
      success: false,
      errors: {
        items: [M.noItems],
        pickupTime: [M.time],
        customerName: [M.name],
        phone: [M.phone],
      },
    });
  });

  it("refuses a phone number that cannot be called", () => {
    const result = parseOrderForm(form({ phone: "123" }));
    expect(result).toMatchObject({
      success: false,
      errors: { phone: [M.phoneInvalid] },
    });
  });

  it("refuses a quantity that is not a whole number", () => {
    const result = parseOrderForm(form({ [`qty.${ROHLIK}`]: "1.5" }));
    expect(result).toMatchObject({
      success: false,
      errors: { items: [M.quantity] },
    });
  });

  it("refuses a missing day", () => {
    const result = parseOrderForm(form({ pickupDate: "" }));
    expect(result).toMatchObject({
      success: false,
      errors: { pickupDate: [M.day] },
    });
  });

  it("sends back what was typed", () => {
    const result = parseOrderForm(form({ customerName: "" }));
    expect(result.values).toEqual({
      pickupDate: "2026-11-27",
      pickupTime: "",
      customerName: "",
      phone: "601 234 567",
      remember: false,
      quantities: { [ROHLIK]: "3", [CHLEB]: "" },
    });
  });

  it("rejects a filled honeypot with a plain message", () => {
    const result = parseOrderForm(form({ website: "https://spam.example" }));
    expect(result).toMatchObject({
      success: false,
      errors: {},
      message: M.failed,
    });
  });

  it("treats a product id that is not from the form as a changed offer", () => {
    const result = parseOrderForm(form({ "qty.not-an-id": "1" }));
    expect(result).toMatchObject({
      success: false,
      errors: { items: [M.changed] },
    });
  });

  it("asks for a reload when the key is missing", () => {
    const result = parseOrderForm(form({ idempotencyKey: "" }));
    expect(result).toMatchObject({ success: false, message: M.reload });
  });
});
