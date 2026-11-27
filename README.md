# Pekárna Planner

The internal tool of a small bakery. Staff record phone reservations in
seconds, customers reserve online through a link, and the app works out what
to bake and what to hand out each day.

**Live:** https://pekarna.stadnik.dev

> **Demo, not a live product.** Built from a short brief; the bakery and its
> data are made up. Choices made only because it is a demo are marked as such
> in the [decisions](docs/decisions/). The demo logins are not in the
> repository; they are handed over with the link.

## The problem

> "People call in to reserve bread and pastries. Managing the reservations and
> working out what to bake takes us a lot of time."

Behind the request are two costs: **time on the phone** and **not knowing what
to bake**. The goal is fewer calls, faster entry for the calls that remain,
and a bake plan nobody computes by hand.

## Assumptions

To confirm with the owner on day one. Details and reasons:
[`docs/brief.md`](docs/brief.md).

- One shop, 10–40 products, tens of reservations a day.
- Pickup in the shop, usually the next day, paid there.
- Orders close at a cutoff, by default the day before at 18:00.
- Some customers will keep calling, so fast staff entry matters as much as
  the online form.
- The bakery also bakes for walk-in sales, so the plan adds a buffer per
  product.
- Regulars (cafés, canteens) order the same thing every week.
- Staff use a tablet or laptop by the phone; the baker wants paper.

## What is built

Requirements R1–R8 from [`docs/requirements.md`](docs/requirements.md). Screen
texts are in Czech.

| #   | Screen               | What it does                                                                                                                                                                                                    |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `/nova`              | Staff record a phone reservation: find the customer by phone or create one, products, pickup day, note. Staff may book after the cutoff.                                                                        |
| R2  | `/`                  | Public order form, no account. Only days before the cutoff, at most 21 days ahead, respects each product's daily limit. The browser remembers name and phone.                                                   |
| R3  | `/objednavka/[code]` | The customer sees the order and can cancel it until the cutoff. The device remembers the links in a cookie.                                                                                                     |
| R4  | `/plan`              | Bake plan, tomorrow by default: reservations (standing orders included) plus the buffer per product. Print view for the baker.                                                                                  |
| R5  | `/dnes`              | The day's reservations: picked up, no-show, cancel, other days. Staff land here after login.                                                                                                                    |
| R6  | `/vyrobky`           | Owner manages products (price, daily limit, buffer, days baked, photo, active) and the order cutoff time.                                                                                                       |
| R7  | `/trvale`            | Owner creates, edits and ends standing orders. A daily job at 03:00 Europe/Prague turns them into ordinary reservations 28 days ahead; days that do not fit the daily limit are skipped and shown to the owner. |
| R8  | `/prihlaseni`        | Login, roles `staff` and `owner` checked on the server, no sign-up. Seeded demo data so the plan is not empty.                                                                                                  |

Stack: Next.js 16 (App Router), shadcn/ui with Tailwind v4, Drizzle on
Postgres (Neon in production), Better Auth, Temporal for dates (Node 26), Bun,
Vercel. Why each was picked is in the decisions below.

## Decisions

1. [Record architecture decisions as MADR](docs/decisions/0001-record-decisions-as-madr.md)
2. [Vercel and Neon Postgres](docs/decisions/0002-vercel-and-neon-postgres.md): managed, free tiers; Hobby is for non-commercial use, so a real bakery would need Pro.
3. [Drizzle over a node-postgres pool](docs/decisions/0003-drizzle-and-node-postgres-pool.md): typed schema in TypeScript, plain SQL migrations, real transactions for the daily-limit check.
4. [Bun, oxlint, Prettier and Vitest](docs/decisions/0004-bun-oxlint-prettier-vitest.md): fast lint and tests; types checked by `tsc`.
5. [A sober design system on shadcn/ui](docs/decisions/0005-design-system-on-shadcn.md)
6. [Better Auth with two staff roles](docs/decisions/0006-better-auth-with-staff-roles.md): demo only has one staff account; a real bakery gives every person their own.
7. [Reservation data model](docs/decisions/0007-reservation-data-model.md): orders keep a copy, so later edits to products or customers cannot change history; standing orders become ordinary reservations, so the plan and the day list need no special case.

## Left out, and why

- **On purpose** (see [`docs/requirements.md`](docs/requirements.md)): online
  payments, ingredient stock, multiple shops, accounting, a native app,
  customer accounts, SMS, pickup time slots, a separate baker account (the
  baker prints the plan), an AI phone agent. None of them saves the owner the
  time they asked about; the phone agent is also costly and unreliable for
  callers who are often older.
- **R10, a draft reservation from a pasted SMS or e-mail** (stretch): not
  built. We don't know the volume of SMS and e-mail orders, and every AI draft
  would still need a person to check it, so it saves little until that is
  confirmed with the owner.
- **Demo shortcuts:** one owner and one staff account; the order form rate
  limit is set by hand (below); no Vercel BotID.

## Next steps

1. Confirm the assumptions with the owner, and time real calls on `/nova`
   against the 20 s target from R1 (not measured yet).
2. One account per person instead of a shared staff login.
3. Vercel BotID on the order action, orders sent with JavaScript only.
4. R10 only if the owner confirms enough SMS and e-mail orders to make it
   worth it.

## How AI was used

The code was written with Claude Code. I set the scope, made the decisions and
approved every commit. The setup is meant to make the agent's work checkable
rather than trusted:

- **Spec first:** [`docs/brief.md`](docs/brief.md) and
  [`docs/requirements.md`](docs/requirements.md) came before code; nothing
  outside them gets built. Rules for every change are in
  [`AGENTS.md`](AGENTS.md).
- **Small steps and tests:** one reviewable change per
  [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/);
  domain logic (bake plan, availability, cutoff) written test-first as pure
  functions.
- **Hooks** ([`.claude/settings.json`](.claude/settings.json)): Prettier on
  every edited file, the agent's turn cannot end until the typecheck passes,
  deny rules for reading `.env` files, pushing and deploying.
- **Independent review before each commit:** two `review-finder` agents
  without context list candidate defects, a `review-verifier` checks each
  against the code ([`.claude/agents/`](.claude/agents/)). The reviewers are
  tested on code with known defects
  ([`.claude/review-evals/`](.claude/review-evals/)).
- **Decisions with sources:** each ADR cites the research it rests on.

### Where it went wrong

Full list in [`docs/ai-log.md`](docs/ai-log.md).

- **A review agent migrated the live database.** To try new migrations
  "locally" it ran `drizzle-kit migrate` with an overridden `DATABASE_URL`,
  but `drizzle.config.ts` prefers `DATABASE_URL_UNPOOLED` from `.env.local`,
  so the live Neon database was migrated before the change was approved. The
  agent reported it; a read-only query confirmed it. Now review agents never
  write to the configured database and try SQL only on a throwaway local
  Postgres.
- **Over-engineered standing orders:** versions per day with overlap
  constraints, while past orders still read live data. I pushed for a simpler
  model; ADR 0007 was rewritten so orders keep a copy.
- **"Industry standards" from memory:** the agent proposed keeping order
  links in `localStorage`. Asked for sources, the research showed OWASP
  advises against tokens in web storage. Rule since: every decision rests on
  cited research.
- **Gaps caught by review:** the first data model could not mark a standing
  order day as picked up; database triggers meant to freeze history could be
  bypassed. Both were found by the review agents and fixed before commit.

## Quality checks

- **Unit tests** (Vitest): bake plan, availability, cutoff and time, phone
  numbers, standing orders, validators.
- **Database tests** on a real Postgres 18 (`bun run test:db`).
- **End-to-end** (Playwright): `/nova`, the order form, the order link,
  `/dnes` with the printed bake plan, `/vyrobky`, `/trvale`, role redirects and server
  actions called without a session.
- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): format,
  lint, unit, database, build with typecheck, end-to-end, `bun audit`.
  Actions are pinned to a SHA and the token is read-only.

## Run it locally

Requires [Bun](https://bun.sh), Node 26 and Docker.

```sh
bun install
cp .env.example .env.local
bun run db:up          # Postgres 18 in Docker
bun run db:migrate
bun run db:seed        # demo accounts (passwords from .env.local) and data
bun run dev            # http://localhost:3000
```

Tests: `bun run test`, `bun run test:db`, `bun run test:e2e`.

## Environments

- **Development:** `.env.local` points at the local Postgres only. The
  production database URL is never on a laptop; it lives only in the Vercel
  project settings.
- **Production:** a production deploy migrates the database itself before
  building (`vercel-build` runs `drizzle-kit migrate` when
  `VERCEL_ENV=production`, on the direct Neon URL). Preview deploys never
  migrate. Migrations are generated locally (`bun run db:generate`), tried on
  the local database (`bun run db:migrate`) and reach production only by
  deploying.
- **Tests:** their own local databases (`.env.test`).
- **Product photos:** stored in a public Vercel Blob store.
  `BLOB_READ_WRITE_TOKEN` is needed only to upload photos; without it the
  upload says it is not set up and the rest works.

## Order form abuse protection (manual step)

The public order form at `/` has no account, so a bot could fill it. In the
code it has a honeypot field, Zod caps (at most 50 products, 999 pieces each)
and the daily limit, and Next.js checks the Origin of server actions. One
rate limit is set by hand in the Vercel dashboard (Firewall → Rules, available
on Hobby):

- If the request method is `POST` and the path equals `/`
- then rate limit: fixed window, 60 s, 10 requests, key IP, action `429`.

Every `POST` to `/` is the order action. _Demo choice:_ a real product would
also put Vercel BotID (Deep Analysis) on the action and accept orders sent
with JavaScript only.

## Where to look

| What                    | Where                                                  |
| ----------------------- | ------------------------------------------------------ |
| Problem and assumptions | [`docs/brief.md`](docs/brief.md)                       |
| Scope (R1–R10)          | [`docs/requirements.md`](docs/requirements.md)         |
| Decisions and why       | [`docs/decisions/`](docs/decisions/)                   |
| Where the AI was wrong  | [`docs/ai-log.md`](docs/ai-log.md)                     |
| Rules for every change  | [`AGENTS.md`](AGENTS.md)                               |
| AI agent setup          | [`CLAUDE.md`](CLAUDE.md), [`.claude/`](.claude/)       |
| CI                      | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
