import { type BetterAuthOptions, betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, haveIBeenPwned } from "better-auth/plugins";
import { ac, isRole, type Role, roles } from "@/lib/permissions";

/** NIST SP 800-63B rev. 4: at least 15 characters when the password is the only factor. */
export const MIN_PASSWORD_LENGTH = 15;

/**
 * Maximum session lifetime per role; sessions are never extended. The owner
 * gets a working day, so an owner login left on the shared tablet does not
 * give the counter owner rights for weeks. Staff keep the tablet signed in for
 * a month.
 */
export const SESSION_HOURS: Record<Role, number> = {
  owner: 12,
  staff: 24 * 30,
};

type Options = {
  /** Look new passwords up in Have I Been Pwned (k-anonymity, only a hash prefix leaves). */
  breachedPasswordCheck?: boolean;
};

/**
 * Staff accounts only: no sign-up, accounts come from the seed (later from the
 * owner). Built by a factory so tests can run the real config on an in-memory
 * database.
 */
export function createAuth(
  database: BetterAuthOptions["database"],
  { breachedPasswordCheck = true }: Options = {},
) {
  return betterAuth({
    appName: "Pekárna Planner",
    // Only these hosts may sign in. Preview deployments are left out on purpose:
    // they share the production database.
    baseURL: {
      allowedHosts: [
        "pekarna.stadnik.dev",
        "pekarna-planner.vercel.app",
        "localhost:3000",
      ],
      fallback: "https://pekarna.stadnik.dev",
    },
    database,
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    session: {
      expiresIn: SESSION_HOURS.staff * 60 * 60,
      disableSessionRefresh: true,
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session, ctx) => {
            const user = await ctx?.context.internalAdapter.findUserById(
              session.userId,
            );
            const role = user && "role" in user ? user.role : null;
            if (!isRole(role)) return;
            // Keep a shorter lifetime Better Auth already chose ("remember me" off).
            const roleLimit = Date.now() + SESSION_HOURS[role] * 60 * 60 * 1000;
            const expiresAt = new Date(
              Math.min(session.expiresAt.getTime(), roleLimit),
            );
            return { data: { ...session, expiresAt } };
          },
        },
      },
    },
    // Serverless instances do not share memory, so the counters live in the database.
    rateLimit: { enabled: true, storage: "database" },
    plugins: [
      admin({ ac, roles, defaultRole: "staff", adminRoles: ["owner"] }),
      ...(breachedPasswordCheck ? [haveIBeenPwned()] : []),
      nextCookies(), // must stay last
    ],
  });
}
