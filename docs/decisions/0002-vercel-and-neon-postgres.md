---
status: accepted
date: 2026-11-25
---

# Host on Vercel with Neon Postgres

## Context and Problem Statement

The app is a Next.js full-stack app with login and a relational database that
must not overbook the last pieces of a product. It has to run publicly on
`pekarna.stadnik.dev`, free of charge, without a server to maintain.

## Considered Options

- Vercel (Hobby) + Neon Postgres (Free)
- Cloudflare Workers (Free) via OpenNext + Neon through Hyperdrive
- Cloudflare Workers with D1 (SQLite)
- Own VPS with Docker (Dokploy or Coolify) + Postgres
- Railway or Render with a Dockerfile + managed Postgres

## Decision Outcome

Chosen option: "Vercel + Neon", because Next.js runs there natively (no
adapter), functions have no tight CPU budget, and Neon is the Postgres Vercel
itself offers in its Marketplace. Postgres gives real transactions for the
availability check. Both are free and need no server maintenance.

Cloudflare Workers Free was rejected: it allows 10 ms CPU per request, and the
default password hashing of the auth library alone is at or over that budget,
so login (a hard requirement) would fail intermittently. D1 has no interactive
transactions. A VPS or Railway costs money and, for a small bakery, adds
operations work nobody would pay for.

### Consequences

- Good, because deploys, previews and HTTPS come with the platform.
- Good, because Postgres runs locally in Docker with the same version, so
  tests hit a real database.
- Bad, because Neon Free suspends compute after 5 minutes idle; the first
  request after that is about a second slower.
- Bad, because Vercel Hobby is for non-commercial use; a real bakery would need
  Pro. Fine for a demo.
- The custom domain is a CNAME in Cloudflare DNS (DNS only).

## More Information

- Cloudflare Workers limits (10 ms CPU on Free): https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/workers/platform/limits.mdx
- Better Auth sign-up exceeds CPU limit on Workers: https://github.com/better-auth/better-auth/issues/8860
- OpenNext Cloudflare (3 MiB Worker on Free): https://opennext.js.org/cloudflare
- Vercel Hobby plan: https://vercel.com/docs/plans/hobby
- Vercel fair use (non-commercial on Hobby): https://vercel.com/docs/limits/fair-use-guidelines
- Neon Free plan limits: https://neon.com/faqs/free-plan-limits-and-quotas
- Neon connection methods on Vercel: https://neon.com/docs/guides/vercel-connection-methods
