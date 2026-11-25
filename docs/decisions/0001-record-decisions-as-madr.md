---
status: accepted
date: 2026-11-25
---

# Record architecture decisions as MADR

## Context and Problem Statement

The project is built with an AI agent in small steps. Choices that are hard
to reverse (stack, hosting, data model, time handling) must stay explainable
later, with the options that were rejected and the sources behind them.

## Considered Options

- MADR records in `docs/decisions/`, one file per decision
- Notes in the README only
- No written decisions, commit messages only

## Decision Outcome

Chosen option: "MADR records in `docs/decisions/`", because each decision
keeps its context, options and sources in one short file, the README links
them as a list, and a superseded decision stays readable next to the one that
replaced it. The `/new-adr` skill writes them in the same format every time.

### Consequences

- Good, because a reviewer can read why, not only what.
- Good, because the agent follows accepted ADRs (`AGENTS.md`, sources of truth).
- Bad, because every significant choice costs a short write-up.

## More Information

- MADR 4.0.0: https://github.com/adr/madr
- Michael Nygard, Documenting Architecture Decisions: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
