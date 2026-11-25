import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, userAc } from "better-auth/plugins/admin/access";

export const ac = createAccessControl(defaultStatements);

/**
 * The owner gets only the account rights the app uses: see accounts, block
 * one and end its sessions. No creating users, changing roles, setting
 * passwords or impersonation over the admin API; accounts come from the seed.
 * Widen this together with the owner pages that need it (ADR 0006).
 */
export const roles = {
  owner: ac.newRole({ user: ["list", "ban"], session: ["list", "revoke"] }),
  staff: ac.newRole(userAc.statements),
};

export type Role = keyof typeof roles;

export function isRole(value: unknown): value is Role {
  return value === "owner" || value === "staff";
}
