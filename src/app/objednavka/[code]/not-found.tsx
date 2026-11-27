import { LinkPageHeader, NewOrderButton } from "@/components/order/link-page";

// One answer for an unknown, expired or malformed link: nothing tells which
// (OWASP "consistent message").
export default function OrderNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-7 pb-6 sm:pt-13">
      <LinkPageHeader title="Objednávka nenalezena" />
      <div className="flex flex-col items-start gap-6">
        <p className="text-muted-foreground">
          Odkaz je neplatný, nebo vypršel. Odkaz platí 30 dní po vyzvednutí.
        </p>
        <NewOrderButton label="Nová objednávka" />
      </div>
    </main>
  );
}
