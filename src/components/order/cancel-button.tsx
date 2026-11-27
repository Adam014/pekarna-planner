"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** The final cancel step; disabled while the request runs. */
export function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" size="lg" disabled={pending}>
      {pending ? "Ruším…" : "Ano, zrušit objednávku"}
    </Button>
  );
}
