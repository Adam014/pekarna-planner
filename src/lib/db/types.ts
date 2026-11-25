import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "./schema";

/** The app's database, or a transaction on it; services take it as input. */
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
