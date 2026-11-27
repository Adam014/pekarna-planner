import type { OverLimit } from "@/lib/services/demand";
import type { Rejection } from "@/lib/services/reservations.service";
import {
  ORDER_FORM_MESSAGES as M,
  type OrderErrors,
} from "@/lib/validators/order-form";

/**
 * Server only (the validator checks phones with libphonenumber); the form
 * gets these texts as props.
 */

const left = (count: number) =>
  count >= 2 && count <= 4 ? "zbývají" : "zbývá";

/** "zbývá 1 ks", "zbývají 3 ks", "zbývá 5 ks". */
export function piecesLeft(count: number): string {
  return `${left(count)} ${count} ks`;
}

/** Why the service refused an online order, as field errors or a message. */
export function rejectionErrors(
  reason: Rejection,
  overLimit: readonly OverLimit[] = [],
): { errors: OrderErrors; message?: string } {
  switch (reason) {
    case "invalid_phone":
      return { errors: { phone: [M.phoneInvalid] } };
    case "unknown_product":
    case "inactive_product":
      return { errors: { items: [M.changed] } };
    case "day_not_bookable":
      return { errors: { pickupDate: [M.day] } };
    case "sold_out":
      return {
        errors: {
          items: overLimit.map((o) =>
            o.remaining === 0
              ? `${o.productName}: už je vyprodáno.`
              : `${o.productName}: ${left(o.remaining)} už jen ${o.remaining} ks.`,
          ),
        },
      };
    case "idempotency_conflict":
      return {
        errors: {},
        message: "Tuto objednávku už jsme přijali. Načtěte stránku znovu.",
      };
  }
}
