import Link from "next/link";
import { signOut } from "@/app/(staff)/actions";
import { StaffNav } from "@/components/staff/staff-nav";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

const ROLE_LABEL = { owner: "Majitel", staff: "Obsluha" } as const;

export async function StaffHeader() {
  const user = await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
      <Link href="/dnes" className="font-semibold">
        Pekárna Planner
      </Link>
      <StaffNav role={user.role} />
      <div className="ml-auto flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {user.name} · {ROLE_LABEL[user.role]}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost">
            Odhlásit
          </Button>
        </form>
      </div>
    </div>
  );
}
