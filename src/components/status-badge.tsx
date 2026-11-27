import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/lib/domain/reservation";

/** Labels as on the design reference page (`/design`); staff and customers see the same words. */
export const STATUS_LABEL: Record<ReservationStatus, string> = {
  reserved: "Rezervováno",
  picked_up: "Vydáno",
  no_show: "Nevyzvednuto",
  cancelled: "Zrušeno",
};

/** Badge variants of the reservation states (ADR 0005). */
const STATUS_VARIANT: Record<
  ReservationStatus,
  "info" | "success" | "warning" | "secondary"
> = {
  reserved: "info",
  picked_up: "success",
  no_show: "warning",
  cancelled: "secondary",
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
