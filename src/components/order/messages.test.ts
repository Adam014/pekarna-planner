import { describe, expect, it } from "vitest";
import type { Rejection } from "@/lib/services/reservations.service";
import { piecesLeft, rejectionErrors } from "./messages";

const REJECTIONS: Rejection[] = [
  "invalid_phone",
  "unknown_product",
  "inactive_product",
  "day_not_bookable",
  "sold_out",
  "idempotency_conflict",
];

describe("piecesLeft", () => {
  it("uses the Czech plural", () => {
    expect([1, 2, 4, 5].map(piecesLeft)).toEqual([
      "zbývá 1 ks",
      "zbývají 2 ks",
      "zbývají 4 ks",
      "zbývá 5 ks",
    ]);
  });
});

describe("rejectionErrors", () => {
  it.each(REJECTIONS)("explains %s", (reason) => {
    const { errors, message } = rejectionErrors(reason, [
      {
        kind: "over_limit",
        date: "2026-11-27",
        productId: "rohlik",
        productName: "Rohlík",
        remaining: 1,
        requested: 2,
      },
    ]);
    const texts = [...Object.values(errors).flat(), message ?? ""];
    expect(texts.join("")).not.toBe("");
  });

  it("names each product over the limit", () => {
    const over = (productName: string, remaining: number) => ({
      kind: "over_limit" as const,
      date: "2026-11-27",
      productId: productName,
      productName,
      remaining,
      requested: 9,
    });
    expect(
      rejectionErrors("sold_out", [over("Rohlík", 3), over("Vánočka", 0)])
        .errors.items,
    ).toEqual(["Rohlík: zbývají už jen 3 ks.", "Vánočka: už je vyprodáno."]);
  });
});
