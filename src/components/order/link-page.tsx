import Link from "next/link";
import { Button } from "@/components/ui/button";

/** The header of the order link page and of its not-found answer. */
export function LinkPageHeader({ title }: { title: string }) {
  return (
    <header className="flex flex-col">
      <Link
        href="/"
        className="inline-flex min-h-11 w-fit items-center text-sm font-medium text-crust underline-offset-4 hover:underline"
      >
        Pekárna Planner
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

/**
 * A plain GET of "/": a fresh form with a new order key, also without
 * JavaScript. A client navigation would bring back the success screen that
 * Next keeps for a visited page (Activity, preserving-ui-state guide).
 */
export function NewOrderButton({
  label,
  quiet = false,
}: {
  label: string;
  /** A muted text button instead of an outlined one. */
  quiet?: boolean;
}) {
  return (
    <form method="get" action="/">
      <Button
        type="submit"
        variant={quiet ? "link" : "outline"}
        size="lg"
        className={
          quiet
            ? "border-0 px-0 text-sm font-normal text-muted-foreground"
            : undefined
        }
      >
        {label}
      </Button>
    </form>
  );
}
