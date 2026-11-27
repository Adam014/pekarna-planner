import { z } from "zod";

/**
 * An order link token: 256 random bits in base64url, 43 characters (ADR
 * 0007). Anything else is refused before the database is asked.
 */
export const orderToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
