// Creates the demo accounts and the demo data (R8). Idempotent: existing
// accounts are left alone, and the data is added only to an empty catalogue.
// `--reset` first deletes all demo data, to move the demo to the current week.
// Passwords come from the environment so they never land in the repository.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const { auth } = await import("@/lib/auth");
const { MIN_PASSWORD_LENGTH } = await import("@/lib/auth-config");
const { db } = await import("@/lib/db");
const { user } = await import("@/lib/db/schema");
const { eq } = await import("drizzle-orm");
const { resetDemo, seedDemo } = await import("@/lib/db/demo-data");

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

const [staff] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, "pekar@pekarna.com"));
if (!staff) throw new Error("The staff account is missing.");
if (process.argv.includes("--reset")) {
  await resetDemo(db);
  console.log("deleted demo data");
}
const demo = await seedDemo(db, Temporal.Now.instant(), staff.id);
console.log(
  demo === "created"
    ? "created demo data"
    : "exists  demo data (products found; --reset to replace it)",
);

process.exit(0);
