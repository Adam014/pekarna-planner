# AGENTS.md

Pekárna Planner is the internal tool of a small bakery: staff record phone
reservations, customers reserve online, and the app works out what to bake and
what to hand out each day. The code, the commits and the docs must stay
clean, and every decision must be explainable.

## Sources of truth (in this order)

1. `docs/brief.md` – the problem and the assumptions behind it.
2. `docs/requirements.md` – scope (R1–R9). Nothing outside it gets built.
3. `docs/decisions/` – Architecture Decision Records (MADR). Follow them; to
   change one, write a new ADR that supersedes it.
4. This file – stack, domain rules, conventions, process.

## Stack (proposed, confirm in ADR 0001 when scaffolding)

- Next.js (App Router) + React + TypeScript strict, Bun as package manager
- PostgreSQL + Drizzle ORM, Better Auth (email + password), Zod
- Tailwind CSS + shadcn/ui
- Vitest for logic, Playwright for the main flows
- Deploy: Vercel + Neon (or own Dokploy), decided in an ADR

Check every version and API against the official docs or the npm registry at
scaffold time, not from memory.

## Domain rules (easy to get wrong)

- **Time zone is `Europe/Prague`.** Pickup days, the cutoff and "today" are
  computed in Prague time on the server, never in UTC or the browser's zone.
  Test around midnight and the DST switch.
- **Cutoff:** a reservation for day D closes at D−1 18:00 by default (setting).
  Staff may override the cutoff for phone orders; the online form may not.
- **Availability:** `dailyLimit − reserved` for that product and day,
  including standing orders. Check it inside the same DB transaction that
  saves the reservation, so two customers cannot overbook the last pieces.
- **Bake plan** for day D, per product baked on D: sum of quantities of
  reservations with status `reserved` or `picked_up` + standing orders for D's
  weekday + the product's buffer. Cancelled and no-show do not count.
- **Money:** CZK as integer haléře (or whole crowns); no floats. Format with
  `Intl.NumberFormat('cs-CZ')`.
- **Phone numbers:** normalise to E.164 (+420…) before saving and searching.
- Status flow: `reserved → picked_up | no_show | cancelled`. Nothing else.

## Conventions

- Code, file names, comments and docs in English; UI text in Czech.
- TypeScript strict with `noUncheckedIndexedAccess`; no `any`, no non-null `!`.
- Business logic (bake plan, availability, cutoff) lives in pure functions
  with unit tests; route handlers and server actions stay thin.
- UI: text never smaller than 14 px; every clickable element has
  `cursor: pointer`; no icons on decorative background shapes. Touch targets
  at least 44 px (tablet by the phone). Print view for the bake plan.
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
   If something cannot be verified, say so.
4. **Logic is test-first.** Bake plan, availability and cutoff get their tests
   before the implementation.
5. **Review before proposing a commit** (`/review-change`), including two
   `review-finder`s and one `review-verifier` (`.claude/agents/`).
6. **UI changes are checked in a real browser** (desktop, tablet, phone width,
   print) before they are called done.
7. **Keep an AI log.** Note in `docs/ai-log.md` where the agent was wrong and
   how it was caught.
8. **The human approves.** Never commit, push or deploy without explicit
   approval.
9. **Record hard-to-reverse decisions** as an ADR (`/new-adr`), with sources.

## Git and infrastructure rules

- Never stage on your own (`git add`, `git mv`, `git rm`): move or delete files
  with plain filesystem commands. Staging happens only in an approved commit.
- No `Co-Authored-By` or "Generated with" lines in commits or PRs.
- Never `git push`, never force-push, never write to the remote.
- Before stating anything about the repo state, run `git status` and `git log`.
- Never change hosting, database or DNS settings; give the human exact steps.
- Only one agent edits the working tree at a time.
