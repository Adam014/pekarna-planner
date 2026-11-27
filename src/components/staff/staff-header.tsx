import Link from "next/link";
import { StaffNav } from "@/components/staff/staff-nav";
import { UserMenu } from "@/components/staff/user-menu";
import { requireUser } from "@/lib/session";

export async function StaffHeader() {
  const user = await requireUser();
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
      <Link
        href="/dnes"
        className="flex min-h-11 items-center text-lg font-semibold tracking-tight"
      >
        Pekárna
      </Link>
      <div className="order-last w-full sm:order-none sm:w-auto">
        <StaffNav role={user.role} />
      </div>
      <div className="ml-auto">
        <UserMenu name={user.name} role={user.role} />
      </div>
    </div>
  );
}
