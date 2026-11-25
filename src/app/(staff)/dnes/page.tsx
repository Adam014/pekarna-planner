import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dnes" };

// The heading is the static shell; everything that needs the session streams in.
export default function TodayPage() {
  return (
    <main className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Dnes</h1>
      <Suspense fallback={<p className="text-muted-foreground">Načítám…</p>}>
        <Today />
      </Suspense>
    </main>
  );
}

async function Today() {
  const user = await requireUser();
  return (
    <p className="text-muted-foreground">
      Dobrý den, {user.name}. Výdej a rezervace na dnešek přibydou v dalším
      kroku.
    </p>
  );
}
