---
status: accepted
date: 2026-11-25
---

# Bun, oxlint, Prettier and Vitest for tooling

## Context and Problem Statement

The project starts from the official `create-next-app` template (Next.js 16),
which no longer ships a linter by default. It needs a package manager, a
linter, a formatter and a test runner.

## Considered Options

- Bun; oxlint; Prettier; Vitest
- pnpm; ESLint with `eslint-config-next`; Prettier; Jest
- Biome for lint and format

## Decision Outcome

Chosen option: "Bun, oxlint, Prettier, Vitest", because oxlint covers the
React, Next.js, TypeScript and import rules this project needs and runs in
well under a second, while type errors are caught by `tsc` (in the Stop hook,
in `next build` and in CI). Prettier keeps the template's code style. Vitest
runs TypeScript without extra setup and pins the test time zone west of UTC,
so a bug that uses the machine's time zone instead of `Europe/Prague` fails.
Bun installs and runs scripts and is pinned by `packageManager`.

### Consequences

- Good, because lint, format and tests stay fast enough to run on every change.
- Bad, because some `eslint-config-next` rules have no oxlint equivalent yet.
- Bad, because `bun test` starts Bun's own runner, not Vitest; always use
  `bun run test` (also in `AGENTS.md`).

## More Information

- Next.js `create-next-app`: https://nextjs.org/docs/app/api-reference/cli/create-next-app
- oxlint plugins: https://oxc.rs/docs/guide/usage/linter/plugins
- Vitest: https://vitest.dev/guide/
- Bun package manager: https://bun.sh/docs/cli/install
