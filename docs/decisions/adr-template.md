---
# proposed | accepted | superseded by [NNNN](NNNN-title.md)
status: accepted
date: YYYY-MM-DD
---

<!--
Template for this project's ADRs: MADR 4.0.0 with the sections we use.
Copy it to NNNN-short-title.md (next free number) and delete these comments.

Rules (sources in .claude/skills/new-adr/SKILL.md):
- One decision. A part with its own options that could be reversed on its
  own gets its own ADR, linked from here.
- One to two pages. Detail and research notes are linked, not copied.
- Every claim is backed by a source in More Information, or removed.
- Once accepted, never edited: a new ADR supersedes it.
-->

# {Problem and chosen solution, e.g. "Postgres row locks for the daily limit"}

## Context and Problem Statement

{Two to three sentences: the situation, the problem to decide, and the scope.
Link the requirement (R1–R10) it serves.}

## Decision Drivers

- {What the options are judged by: a requirement, a quality, a constraint}
- {…}

## Considered Options

- {Chosen option, listed first}
- {Real alternative at the same level, one that could solve the problem}
- {…}

## Decision Outcome

Chosen option: "{chosen option}", because {justification tied to the drivers}.

{Only what someone implementing or reviewing it needs: the rules that follow
from the decision, in a few bullets.}

### Consequences

- Good, because {…}
- Bad, because {… never left out; include what a later change would cost}

### Confirmation

{How we check that the code follows the decision: tests, a review rule, a
database constraint.}

## Pros and Cons of the Options

### {Option that was not chosen}

- Good, because {…}
- Bad, because {…}

## More Information

- {Source title}: {URL}
- Research notes (local): `docs/research/reports/{file}.md`
- Related: [ADR NNNN](NNNN-title.md)
