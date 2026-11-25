// Creates the demo accounts. Idempotent: existing accounts are left alone.
// Passwords come from the environment so they never land in the repository.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const { auth } = await import("@/lib/auth");
const { MIN_PASSWORD_LENGTH } = await import("@/lib/auth-config");
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/schema");
const { eq } = await import("drizzle-orm");

const accounts = [
  {
    email: "majitel@pekarna.com",
    name: "Petra Malá",
    role: "owner",
    passwordEnv: "SEED_OWNER_PASSWORD",
  },
  {
    email: "pekar@pekarna.com",
    name: "Tomáš Novák",
    role: "staff",
    passwordEnv: "SEED_STAFF_PASSWORD",
  },
] as const;

for (const account of accounts) {
  const password = process.env[account.passwordEnv];
  if (!password) throw new Error(`${account.passwordEnv} is not set.`);
  // The admin API does not enforce the minimum length, so the seed does.
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${account.passwordEnv} must have at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, account.email));
  if (existing) {
    console.log(`exists  ${account.email}`);
    continue;
  }
  // Called on the server without a session, the admin plugin allows creating users.
  await auth.api.createUser({
    body: {
      email: account.email,
      password,
      name: account.name,
      role: account.role,
    },
  });
  console.log(`created ${account.email} (${account.role})`);
}

process.exit(0);
