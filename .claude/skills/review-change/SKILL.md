---
name: review-change
description: Review the uncommitted change in Pekárna Planner before a commit is proposed. Checks the diff against docs/brief.md, docs/requirements.md, the ADRs and AGENTS.md, verifies uncertain claims against official docs, and runs the project checks. Use before every commit proposal or when the user asks for a review ("pitva").
---

# Review a change before committing

Goal: catch what a senior reviewer would catch, before they do.
Report only real problems you can point to in the diff; no speculation.

## Steps

1. Look at the change: `git status --short` and `git diff` (plus new files).
2. Run the checks and note any failure: `bun run typecheck`, `bun run lint`,
   `bun run format:check`, `bun run test`, `bun run build`.
3. Check the diff against, in this order:
   - `docs/requirements.md` – does it serve a requirement (R1–R10)? Anything out of scope?
   - `docs/decisions/` – does it contradict an ADR? Does it need a new one?
   - `AGENTS.md` – domain rules (Prague time zone, cutoff, availability in a
     transaction, bake plan formula, money, phone normalisation), conventions, UI rules.
4. Look for the usual senior-level issues: correctness and edge cases, race
   conditions, auth on every server action and route, input validation,
   accessibility, dead code, unnecessary dependencies or abstractions, missing
   tests for logic. Tests must assert behaviour, not just raise coverage.
5. **Verify, don't guess.** For every claim about a version, default, API or
   config option you are not certain of, check the official docs, the package's
   types in `node_modules`, or the npm registry. Say which source.
6. **Independent review** (find, then verify):
   1. Run two `review-finder` subagents in parallel with the same brief: the
      scope ("review the uncommitted change") and how the code will be used.
      Never add your own conclusions, and never pass a `model` override.
   2. Merge their candidates into one numbered list.
   3. Run one `review-verifier` with the same brief plus the merged list.
   4. Fix every confirmed finding, or reject it with evidence.

## Report (short)

- **OK** – what is in line with the requirements (one line each).
- **Problems** – ordered by severity; each with file, why it matters, and the fix.
- **Independent review** – each finding: fixed, or rejected and why.
- **Verified** – what you checked and where.
- **Deferred** – what is consciously left for later, and why.
- Proposed commit message (Conventional Commits). Do not commit until the human
  approves.
