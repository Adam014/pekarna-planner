import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** The signed-in user, or null. Validates the session against the database. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || !isRole(session.user.role)) return null;
  const { id, name, email, role } = session.user;
  return { id, name, email, role };
});

/**
 * Every staff page and service starts here. Without a session it goes to the
 * login; a staff member opening an owner page goes back to "Dnes".
 */
export async function requireUser(role?: Role): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/prihlaseni");
  if (role === "owner" && user.role !== "owner") redirect("/dnes");
  return user;
}
