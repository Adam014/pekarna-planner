"use client";

import { startTransition, useActionState } from "react";
import { toast } from "sonner";
import { type CutoffState, saveCutoff } from "@/app/(staff)/vyrobky/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cutoffSavedMessage } from "./messages";

/** The order cutoff for the whole bakery, saved on its own. */
export function CutoffForm({ time }: { time: string }) {
  const [state, dispatch, pending] = useActionState(
    async (prev: CutoffState, payload: { time: string }) => {
      const result = await saveCutoff(prev, payload);
      if (result.status === "saved") {
        toast.success(cutoffSavedMessage(result.time, result.tomorrowClosed), {
          id: "cutoff-saved",
        });
      }
      return result;
    },
    { status: "idle" },
  );
  const error = state.status === "invalid" ? state.message : undefined;

  return (
    <section aria-labelledby="cutoff-heading" className="flex flex-col gap-2">
      <h2 id="cutoff-heading" className="font-semibold">
        Uzávěrka objednávek
      </h2>
      <p id="cutoff-hint" className="text-muted-foreground">
        Objednávky na další den končí den předem v tento čas.
      </p>
      <form
        noValidate
        className="mt-1 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const value = new FormData(e.currentTarget).get("time");
          const payload = { time: typeof value === "string" ? value : "" };
          startTransition(() => dispatch(payload));
        }}
      >
        <Input
          id="cutoff-time"
          name="time"
          type="time"
          required
          defaultValue={time}
          aria-labelledby="cutoff-heading"
          className="w-36 tabular-nums"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "cutoff-hint cutoff-error" : "cutoff-hint"}
        />
        <Button
          type="submit"
          variant="outline"
          aria-disabled={pending || undefined}
        >
          {pending ? "Ukládám…" : "Uložit"}
        </Button>
      </form>
      {error && (
        <p id="cutoff-error" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
