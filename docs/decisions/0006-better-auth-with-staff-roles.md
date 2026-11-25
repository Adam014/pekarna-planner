---
status: accepted
date: 2026-11-25
---

# Better Auth with two staff roles

## Context and Problem Statement

Customers order without an account. Only the bakery signs in: staff on a shared
tablet and the owner, who also manages products and standing orders. Sessions,
password hashing and rate limiting must be done properly, without building
them by hand or paying for a service.

## Considered Options

- Better Auth (library, data in our Postgres)
- Auth.js
- A hosted service (Clerk, Neon Auth)
- Own sessions on top of the Next.js guide

## Decision Outcome

Chosen option: "Better Auth", because the users and sessions live in our own
database next to the reservations, it has email and password sign-in with
scrypt hashing built in, and its admin plugin gives roles, banning and
server-side user creation. Auth.js treats credentials sign-in as a second-class
path, a hosted service adds a vendor for two accounts, and hand-written
sessions are easy to get wrong.

How it is set up (checked against OWASP ASVS 5.0 and NIST SP 800-63B rev. 4):

- **Accounts:** no sign-up (`disableSignUp`). The seed creates the owner and a
  staff account; passwords come from environment variables, never from the
  repository, and the database stores only scrypt hashes.
- **Passwords:** at least 15 characters (NIST for password-only login), no
  composition rules, no forced rotation. New passwords are checked against
  Have I Been Pwned; only a 5-character hash prefix leaves the server.
- **Roles:** `owner` and `staff` via the admin plugin's access control
  (`src/lib/permissions.ts`). The owner may only list accounts, ban one and
  end its sessions; creating users, changing roles, setting passwords and
  impersonation are not granted until an owner page needs them. Staff have no
  admin rights.
- **Sessions:** a maximum lifetime that is never extended
  (`disableSessionRefresh`): 12 hours for the owner, 30 days for staff, set
  per role in a session hook, which keeps a shorter lifetime when the user
  unticks "remember me". An owner login left on the shared tablet expires the
  same day; the tablet itself stays signed in for a month. Banning a user ends
  all their sessions at once.
- **Brute force:** sign-in goes from the browser to `/api/auth`, so Better
  Auth's rate limit applies (3 attempts per 10 s per IP). Counters live in
  Postgres because serverless instances do not share memory. Vercel sets the
  client IP header itself, so it cannot be spoofed.
- **Errors:** a wrong password and an unknown e-mail get the same message.
- **Checks:** `proxy.ts` only redirects requests without a session cookie.
  The real check is `requireUser()` (`src/lib/session.ts`), which every staff
  page and service calls and which validates the session in the database.
- **Origins:** `baseURL` lists the allowed hosts (custom domain, Vercel domain,
  localhost). Preview deployments cannot sign in on purpose, because they use
  the production database.
- **Headers:** `nosniff`, `Referrer-Policy`, `Permissions-Policy` and a CSP
  with `frame-ancestors 'none'` on every response (`next.config.ts`).
- **Tests:** `src/lib/auth-config.test.ts` runs the real config on an
  in-memory database: no sign-up, equal errors, session lifetimes per role,
  the owner's limited admin rights, banning.
- **Demo access:** the demo credentials are not in the repository; they are
  handed over together with the link to the live demo.

### Consequences

- Good, because auth data and app data share one database and one migration flow.
- Good, because roles are checked on the server, not just by hiding links.
- Demo only: there is one staff account. A real bakery would give every
  person their own account (the owner creates them), so the log shows who did
  what and nobody shares a password.
- Bad, because there is no per-account lockout, only the per-IP limit. Everyone
  at the bakery shares one IP, so the limit is effectively per bakery.
- Bad, because Better Auth always names the cookie `__Secure-…`; the stricter
  `__Host-` prefix is not possible.
- Next steps for a real product: the owner managing per-person accounts, a
  change-password page, forcing a new password after the first sign-in, and a
  full script CSP with nonces.

## More Information

- Better Auth with Next.js: https://better-auth.com/docs/integrations/next
- Drizzle adapter: https://better-auth.com/docs/adapters/drizzle
- Admin plugin and access control: https://better-auth.com/docs/plugins/admin
- Rate limiting: https://better-auth.com/docs/concepts/rate-limit
- OWASP ASVS 5.0: https://owasp.org/www-project-application-security-verification-standard/
- NIST SP 800-63B rev. 4: https://pages.nist.gov/800-63-4/sp800-63b.html
- Have I Been Pwned range API: https://haveibeenpwned.com/API/v3#PwnedPasswords
- Next.js authentication guide: `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
