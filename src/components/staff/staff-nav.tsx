"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/permissions";

// Screens are added here as they are built (see docs/requirements.md).
const ITEMS: { href: string; label: string; roles: readonly Role[] }[] = [
  { href: "/dnes", label: "Dnes", roles: ["staff", "owner"] },
  { href: "/plan", label: "Plán pečení", roles: ["staff", "owner"] },
];

export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hlavní navigace" className="flex gap-1">
      {ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
              active && "bg-accent text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
