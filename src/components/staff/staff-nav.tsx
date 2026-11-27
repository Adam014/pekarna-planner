"use client";

import {
  CroissantIcon,
  ListChecksIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/permissions";
import { cn } from "@/lib/utils";

// Screens are added here as they are built (see docs/requirements.md).
const ITEMS: {
  href: string;
  label: string;
  /** On a phone, where three full labels do not fit. */
  short: string;
  icon: LucideIcon;
  roles: readonly Role[];
}[] = [
  {
    href: "/dnes",
    label: "Dnes",
    short: "Dnes",
    icon: ListChecksIcon,
    roles: ["staff", "owner"],
  },
  {
    href: "/nova",
    label: "Nová rezervace",
    short: "Nová",
    icon: PlusIcon,
    roles: ["staff", "owner"],
  },
  {
    href: "/plan",
    label: "Plán pečení",
    short: "Plán",
    icon: CroissantIcon,
    roles: ["staff", "owner"],
  },
];

/**
 * The staff screens as one segmented control. The tapped item turns active
 * at once and dims until its page arrives, so a tap never feels lost.
 */
export function StaffNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hlavní navigace" className="w-full sm:w-auto">
      <ul className="flex rounded-xl bg-muted p-1">
        {ITEMS.filter((item) => item.roles.includes(role)).map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1 sm:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow,transform] duration-150 select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:scale-[0.97]",
                  active && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn("size-4", active && "text-crust")}
                />
                <span className="sm:hidden">{item.short}</span>
                <span className="hidden sm:inline">{item.label}</span>
                <Pending />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** A thin bar under the label while the page loads. */
function Pending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-1 h-0.5 origin-left scale-x-0 rounded-full bg-crust opacity-0 transition-[transform,opacity] duration-500",
        pending && "scale-x-100 opacity-100",
      )}
    />
  );
}
