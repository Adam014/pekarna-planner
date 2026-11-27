# Pekárna Planner

The internal tool of a small bakery. Staff record phone reservations in
seconds, customers reserve online through a link, and the app works out what
to bake and what to hand out each day.

**Live:** https://pekarna.stadnik.dev

> **Demo, not a live product.** Built from a short brief; the bakery and its
> data are made up. Choices made only because it is a demo are marked as such
> in the [decisions](docs/decisions/).

> Status: scaffolded (Next.js, Postgres, tooling). Features follow
> `docs/requirements.md` step by step. This README grows with the code.

## Run it locally

Requires [Bun](https://bun.sh) and Docker.

```sh
bun install
cp .env.example .env.local
bun run db:up          # Postgres 18 in Docker
bun run db:migrate
bun run db:seed        # demo accounts (passwords from .env.local) and data
bun run dev            # http://localhost:3000
```

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

## The problem

> "People call in to reserve bread and pastries. Managing the reservations and
> working out what to bake takes us a lot of time."

Behind the request are two costs: **time on the phone** and **not knowing what
to bake**. The goal is fewer calls, faster entry for the calls that remain,
and a bake plan nobody computes by hand. Assumptions and reasoning:
[`docs/brief.md`](docs/brief.md).

## Where to look

| What                    | Where                                                  |
| ----------------------- | ------------------------------------------------------ |
| Problem and assumptions | [`docs/brief.md`](docs/brief.md)                       |
| Scope (R1–R10)          | [`docs/requirements.md`](docs/requirements.md)         |
| Decisions and why       | [`docs/decisions/`](docs/decisions/) (below)           |
| Where the AI was wrong  | [`docs/ai-log.md`](docs/ai-log.md)                     |
| Rules for every change  | [`AGENTS.md`](AGENTS.md)                               |
| AI agent setup          | [`CLAUDE.md`](CLAUDE.md), [`.claude/`](.claude/)       |
| CI                      | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

## How it is built

Built with Claude Code as a pair programmer, under rules that make its work
checkable rather than trusted:

1. **Spec before code.** The problem, assumptions and scope are written first
   ([`docs/brief.md`](docs/brief.md), [`docs/requirements.md`](docs/requirements.md)).
   Nothing outside the requirements gets built; out-of-scope items are listed
   with the reason.
2. **Small steps.** Each step is one reviewable change and one
   [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/).
3. **Tests as checkpoints.** Business logic (bake plan, availability, cutoff)
   is written test-first as pure functions.
4. **Hooks.** [`.claude/settings.json`](.claude/settings.json) formats every
   edited file with Prettier and blocks the end of an agent turn until the
   typecheck passes. Deny rules block reading secrets, pushing and deploying.
5. **Independent review before every commit** (`/review-change`): the checks
   run, then two `review-finder` agents with no context list candidate
   defects, a `review-verifier` confirms or rejects each against the code, and
   only confirmed findings are fixed ([`.claude/agents/`](.claude/agents/)).
6. **The reviewers are tested too.** [`.claude/review-evals/`](.claude/review-evals/)
   holds code with known defects (overbooking race, cutoff in the wrong time
   zone, wrong bake plan) that the review must catch.
7. **Decisions are recorded** as [MADR](https://adr.github.io/madr/) records
   with sources (`/new-adr`).
8. **Mistakes are logged.** Every real agent mistake goes into
   [`docs/ai-log.md`](docs/ai-log.md) with the check that caught it.
9. **A human approves** scope, decisions and every commit. CI runs the same
   checks on every push and pull request.

## Decisions

1. [Record architecture decisions as MADR](docs/decisions/0001-record-decisions-as-madr.md)
2. [Host on Vercel with Neon Postgres](docs/decisions/0002-vercel-and-neon-postgres.md)
3. [Drizzle ORM over a node-postgres pool](docs/decisions/0003-drizzle-and-node-postgres-pool.md)
4. [Bun, oxlint, Prettier and Vitest for tooling](docs/decisions/0004-bun-oxlint-prettier-vitest.md)
5. [A sober design system on shadcn/ui](docs/decisions/0005-design-system-on-shadcn.md)
6. [Better Auth with two staff roles](docs/decisions/0006-better-auth-with-staff-roles.md)
7. [Reservation data model: orders keep a copy, standing orders create reservations](docs/decisions/0007-reservation-data-model.md)
