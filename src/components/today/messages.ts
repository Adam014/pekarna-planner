import type { SetStatusResult } from "@/app/(staff)/dnes/actions";
import { STATUS_LABEL } from "@/components/status-badge";
import type { ReservationStatus } from "@/lib/domain/reservation";

/** The toast after a saved change. */
export function changedMessage(name: string, to: ReservationStatus): string {
  return to === "reserved"
    ? `${name}: vráceno k výdeji`
    : `${name}: ${STATUS_LABEL[to].toLowerCase()}`;
}

/** Why a change was not saved, or null when it was. */
export function refusalMessage(result: SetStatusResult): string | null {
  switch (result.status) {
    case "updated":
      return null;
    case "sold_out":
      return `Nejde vrátit, denní limit je vyčerpaný: ${result.products.join(", ")}.`;
    case "too_early":
      return "Vydání a nevyzvednutí jde označit až v den vyzvednutí.";
    case "changed":
      return "Objednávku mezitím změnil někdo jiný. Seznam je aktualizovaný.";
    case "not_found":
      return "Objednávka už neexistuje. Seznam je aktualizovaný.";
    case "invalid":
      return "Změnu se nepodařilo uložit. Obnovte stránku a zkuste to znovu.";
  }
}
