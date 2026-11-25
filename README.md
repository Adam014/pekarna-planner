# Pekárna Planner

The internal tool of a small bakery. Staff record phone reservations in
seconds, customers reserve online through a link, and the app works out what
to bake and what to hand out each day.

> Status: specification and workflow are in place; the app is not scaffolded
> yet. This README grows with the code.

## The problem

> "People call in to reserve bread and pastries. Managing the reservations and
> working out what to bake takes us a lot of time."

Behind the request are two costs: **time on the phone** and **not knowing what
to bake**. The goal is fewer calls, faster entry for the calls that remain,
and a bake plan nobody computes by hand. Assumptions and reasoning:
[`docs/brief.md`](docs/brief.md).

## Where to look

| What                   | Where                                                    |
| ---------------------- | -------------------------------------------------------- |
| Problem and assumptions | [`docs/brief.md`](docs/brief.md)                        |
| Scope (R1–R9)          | [`docs/requirements.md`](docs/requirements.md)           |
| Decisions and why      | [`docs/decisions/`](docs/decisions/) (below)             |
| Where the AI was wrong | [`docs/ai-log.md`](docs/ai-log.md)                       |
| Rules for every change | [`AGENTS.md`](AGENTS.md)                                 |
| AI agent setup         | [`CLAUDE.md`](CLAUDE.md), [`.claude/`](.claude/)         |
| CI                     | [`.github/workflows/ci.yml`](.github/workflows/ci.yml)   |

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
