import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuth } from "@/lib/auth-config";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = createAuth(drizzleAdapter(db, { provider: "pg", schema }));
