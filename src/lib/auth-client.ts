import { createAuthClient } from "better-auth/react";

/** Sign-in goes through the `/api/auth` handler so Better Auth's rate limit applies. */
export const authClient = createAuthClient();
