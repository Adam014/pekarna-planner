<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Pekárna Planner is the internal tool of a small bakery: staff record phone
reservations, customers reserve online, and the app works out what to bake and
what to hand out each day. The code, the commits and the docs must stay
clean, and every decision must be explainable.

## This is a demo, not a live product

Pekárna Planner is a working demo built from a short brief, not software a
real bakery runs on. There is no real bakery, no real customers and no real
staff. Work with that in mind:

- Build it the way a real product would be built (security, tests, clean
  code), but keep the scope of a demo: the requirements, nothing more.
- Demo data and accounts are made up (`bun run db:seed`). A real bakery would
  have one account per person; the demo has one owner and one staff account.
- When a decision is made only because this is a demo, say so in the ADR or
  README and write what a real product would do instead.

## Sources of truth (in this order)

1. `docs/brief.md` – the problem and the assumptions behind it.
2. `docs/requirements.md` – scope (R1–R10). Nothing outside it gets built.
3. `docs/decisions/` – Architecture Decision Records (MADR). Follow them; to
   change one, write a new ADR that supersedes it.
4. This file – stack, domain rules, conventions, process.
5. `docs/research/` – local research notes and reports with cited sources
   (gitignored, may be missing in a fresh clone). Read the report before
   proposing tooling or architecture changes.

## Stack

- Next.js (App Router) + React + TypeScript strict, Bun as package manager
- PostgreSQL (Neon in production, Docker locally) + Drizzle ORM over a `pg`
  Pool with `attachDatabasePool` (ADR 0003)
- Better Auth (email + password), Zod
- Tailwind CSS + shadcn/ui
- Vitest for logic and services, Playwright for the main flows
- Hosting: Vercel, domain `pekarna.stadnik.dev` via Cloudflare DNS (ADR 0002)

Check every version and API against the official docs, the package's types in
`node_modules` or the npm registry, not from memory. Next.js docs for the
installed version are in `node_modules/next/dist/docs/`.

## Commands

Bun is the package manager and script runner (`packageManager` in `package.json`).

- `bun install` – install dependencies (commit `bun.lock`)
- `bun run db:up` / `bun run db:down` – local Postgres in Docker (`docker-compose.yml`)
- `cp .env.example .env.local` – local `DATABASE_URL`
- `bun run dev` – Next.js dev server
- `bun run typecheck` – route types + `tsc --noEmit`
- `bun run lint` – oxlint; `bun run format` / `format:check` – Prettier
- `bun run test` / `test:watch` – Vitest unit tests. Never `bun test`: it
  runs Bun's own runner. Tests run with `TZ=America/New_York` on purpose.
- `bun run test:db` – service tests (`*.db.test.ts`) on a real Postgres 18 at
  `TEST_DATABASE_URL` (`.env.test`). They drop and rebuild its schema, so it must be a
  separate local database; `test/db.ts` refuses anything not on localhost.
- `bun run test:e2e` – Playwright tests of the main flows (`e2e/`) against a
  production build on port 3100 and `E2E_DATABASE_URL` (`.env.test`), another
  local database that every run rebuilds. Once: `bunx playwright install chromium`.
- `bun run build` – production build (includes type checking)
- `bun run db:generate` – SQL migration from the schema; `db:migrate` applies
  it; `db:seed` creates the demo accounts and data (`-- --reset` moves the
  data to the current week); `db:studio` browses the data
- After changing `src/lib/auth-config.ts`: `bunx auth@1.7.28 generate --config src/lib/auth.ts --output src/lib/db/schema/auth.ts`, then `db:generate`

## Layout (as in our other Next.js apps)

- `src/app/` – routes. `(staff)` route group behind login, public order page
  outside it. Pages and server actions stay thin and call services.
- `src/components/ui/` – shadcn/ui primitives; feature components next to them
  in `src/components/<feature>/`
- `src/lib/domain/` – pure business logic (bake plan, availability, cutoff,
  phone numbers), no I/O, fully unit tested
- `src/lib/services/` – one `<feature>.service.ts` per feature: takes the
  database and already validated input, calls the domain, reads and writes
  the DB, and returns expected outcomes (rejected, needs confirmation) as
  values. Server actions check the session and validate with Zod first
- `src/lib/validators/` – Zod schemas shared by forms and services
- `src/lib/db/` – Drizzle client (`index.ts`), `schema/` (one file per table
  group), `migrations/` (generated SQL, committed), seed script
- `src/lib/auth-config.ts` – the Better Auth config (factory, tested in
  `auth-config.test.ts`); `src/lib/auth.ts` / `auth-client.ts` – server and client;
  `src/lib/permissions.ts` – roles; `src/lib/session.ts` – `requireUser()`
- `src/proxy.ts` – optimistic redirect to the login for staff URLs (cookie only)

## Domain rules (easy to get wrong)

- **Time zone is `Europe/Prague`.** Pickup days, the cutoff and "today" are
  computed in Prague time on the server, never in UTC or the browser's zone.
  Test around midnight and the DST switch. Use `Temporal` (built into Node 26,
  pinned in `engines` and `.node-version`), no date library.
- **Cutoff:** a reservation for day D closes at D−1 18:00 by default (setting).
  Staff may override the cutoff for phone orders; the online form may not.
- **Availability:** `dailyLimit −` pieces in `reserved` and `picked_up`
  reservations for that product and day (standing order days are
  reservations too). Check it inside the same DB transaction that saves the
  reservation, after locking the product rows (`FOR UPDATE`, sorted by id), so
  two customers cannot overbook the last pieces (ADR 0007). The same applies
  to every write that adds demand, including standing order days. The limit
  is hard for everyone: online, staff and standing orders (a day that does
  not fit is not created and is reported). Staff only confirm a warning for
  a day the product is not baked.
  Postgres returns `sum()` as `bigint`, which node-postgres reads as a string:
  cast it (`::int` or `mapWith(Number)`).
- **Orders keep a copy** of the customer's name and phone and of each
  product's name and price; never read them live for a past order (ADR 0007).
- **Standing orders are templates** that create ordinary reservations
  (`source = 'standing_order'`) 28 days ahead: on save, by a daily job
  (`vercel.json` schedule, route checks `CRON_SECRET`), and
  when the bake plan or the day's list is opened.
  Editing one recreates only its future `reserved` days still before the
  cutoff. Creating days must be safe to run twice (`ON CONFLICT DO NOTHING`).
  Nobody books more than 21 days ahead (ADR 0007).
- **Dates:** the pickup day is a Postgres `date`, a `'YYYY-MM-DD'` string in
  code; never turn it into a JS `Date`.
- **Bake plan** for day D, per product baked on D: sum of quantities of
  reservations with status `reserved` or `picked_up` (standing order days
  included) + the product's buffer. Cancelled and no-show do not count.
- **Money:** CZK as integer haléře (or whole crowns); no floats. Format with
  `Intl.NumberFormat('cs-CZ')`.
- **Phone numbers:** normalise to E.164 (+420…) before saving and searching.
- Status: `reserved`, `picked_up`, `no_show`, `cancelled`. Staff may change
  it either way to fix a wrong mark; bringing an order back to `reserved` or
  `picked_up` is refused when it no longer fits the limit. Customers only cancel, before the
  cutoff.
- **Auth (ADR 0006):** every staff page and every server action calls
  `requireUser()` (or `requireUser("owner")`) on the server before a service; hiding a link is
  not a check. With Cache Components, read the session inside a `<Suspense>`
  in the page, never at the top of a layout or page. No sign-up; accounts come
  from `bun run db:seed`.

## Conventions

- Code, file names, comments and docs in English; UI text in Czech.
- TypeScript strict with `noUncheckedIndexedAccess`; no `any`, no non-null `!`.
- Business logic (bake plan, availability, cutoff) lives in pure functions
  in `src/lib/domain/` with unit tests; route handlers and server actions stay
  thin.
- UI: text never smaller than 14 px; every clickable element has
  `cursor: pointer`; no icons on decorative background shapes. Touch targets
  at least 44 px (tablet by the phone). Print view for the bake plan.
- Design system (ADR 0005, reference page `/design`): a sober internal tool.
  shadcn/ui (Radix) components in `src/components/ui/`, tokens only in
  `src/app/globals.css`, never hard-coded colours. Warm neutrals, near-black
  primary, one accent `crust`. Reservation states use badge variants: `info`
  reserved, `success` picked up, `warning` no-show, `secondary` cancelled.
  Font Allo (OFL, `src/app/_fonts/`) for text, Geist Mono for code; numbers
  in tables use `tabular-nums`. Dark mode follows the system; no theme switch.
  Hide controls in print with `data-print="hide"`. Adding a shadcn component:
  `bunx shadcn@latest add <name>`, then raise sizes to these rules.
- Keep it simple: no abstraction without a second use, no speculative options.
- No hacks. Fix the cause with the documented approach; never hide a symptom
  (empty `catch`, `as` casts, `!important`, timeouts, disabled lint rules).
- Docs are short and specific.

## How we work

1. **Spec first, then code.** Scope changes go into `docs/requirements.md`
   before any code.
2. **One step at a time.** Each step is one small, reviewable change that
   becomes one Conventional Commit (`feat:`, `fix:`, `chore:`, `docs:`,
   `test:`, `ci:`).
3. **Verify, don't guess.** Versions, APIs and config come from official docs.
   Every design decision rests on research of quality sources (official docs,
   standards, recognised authors), saved in `docs/research/reports/` and cited
   in the ADR. Never call something a standard from memory. If something
   cannot be verified, say so.
4. **Logic is test-first.** Bake plan, availability and cutoff get their tests
   before the implementation.
5. **Review before proposing a commit** (`/review-change`): check the diff
   against the requirements, the ADRs and this file, and run `typecheck`,
   `lint`, `format:check`, `test` and `build`. New logic comes with tests in
   the same commit. Then independent agents with fresh context review it: two
   `review-finder`s list candidates, a `review-verifier` confirms or rejects
   each (`.claude/agents/`). Confirmed findings get fixed. After changing these
   agents, run `.claude/review-evals/`; when a review misses a real defect,
   add it there as a case.
6. **UI changes are checked in a real browser** (desktop, tablet, phone width,
   print) before they are called done.
7. **Keep an AI log.** Note in `docs/ai-log.md` where the agent was wrong and
   how it was caught.
8. **The human approves.** Never commit, push or deploy without explicit
   approval.
9. **Record hard-to-reverse decisions** as an ADR (`/new-adr`), with sources.

## CI

`.github/workflows/ci.yml` runs format, lint, tests, build and a dependency
audit on every push and pull request (skipped until `package.json` exists).
Actions are pinned by SHA; Dependabot keeps them and the dependencies current
with a 7-day cooldown. The deploy job is added together with the hosting ADR.

## Git and infrastructure rules

- Never stage on your own (`git add`, `git mv`, `git rm`): move or delete files
  with plain filesystem commands. Staging happens only in an approved commit.
- No `Co-Authored-By` or "Generated with" lines in commits or PRs.
- Never `git push`, never force-push, never write to the remote.
- Before stating anything about the repo state, run `git status` and `git log`.
- Never change hosting, database or DNS settings; give the human exact steps.
- Only one agent edits the working tree at a time.
