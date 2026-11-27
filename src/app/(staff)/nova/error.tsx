"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Unexpected errors only; refused marks come back as values from the action.
export default function NewReservationError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Něco se nepovedlo
      </h1>
      <p className="text-muted-foreground">
        Formulář se nepodařilo načíst nebo uložit. Zkuste to znovu; když chyba
        trvá, obnovte stránku.
      </p>
      <Button onClick={() => retry()}>Zkusit znovu</Button>
    </main>
  );
}
