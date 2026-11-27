"use client";

import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import { signOut } from "@/app/(staff)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/permissions";

const ROLE_LABEL = { owner: "Majitel", staff: "Obsluha" } as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Who is signed in, with sign-out one tap away. */
export function UserMenu({ name, role }: { name: string; role: Role }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-11 cursor-pointer items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-muted"
        aria-label={`Účet: ${name}`}
      >
        {/* An avatar with initials, the one allowed shape behind text. */}
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-crust text-sm font-semibold text-crust-foreground"
        >
          {initials(name)}
        </span>
        <span className="hidden md:inline">{name}</span>
        <ChevronDownIcon aria-hidden className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5 py-2 font-normal">
          <span className="font-medium text-foreground">{name}</span>
          <span className="text-sm text-muted-foreground">
            {ROLE_LABEL[role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 cursor-pointer"
          onSelect={() => void signOut()}
        >
          <LogOutIcon aria-hidden />
          Odhlásit
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
