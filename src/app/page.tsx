import Link from "next/link";

export default function OrderPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-16">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-crust">Pekárna Planner</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Objednávka pečiva
        </h1>
        <p className="text-muted-foreground">
          Objednávkový formulář přibude v dalším kroku.
        </p>
      </header>
      <footer className="mt-auto">
        <Link
          href="/prihlaseni"
          className="inline-flex h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Přihlášení pro pekárnu
        </Link>
      </footer>
    </main>
  );
}
