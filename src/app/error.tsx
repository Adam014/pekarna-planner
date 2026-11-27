"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

// Unexpected errors on the order page; refused orders come back as values
// from the action and are shown in the form.
export default function OrderError({
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
    <main className="mx-auto flex w-full max-w-2xl flex-col items-start gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Něco se nepovedlo
      </h1>
      <p className="text-muted-foreground">
        Stránku se nepodařilo načíst. Zkuste to znovu; když chyba trvá, obnovte
        stránku.
      </p>
      <Button onClick={() => retry()}>Zkusit znovu</Button>
    </main>
  );
}
