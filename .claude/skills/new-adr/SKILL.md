---
name: new-adr
description: Write a new Architecture Decision Record in docs/decisions/ from docs/decisions/adr-template.md (MADR 4.0.0), backed by research with cited sources, and check it against the ADR checklist. Use when a hard-to-reverse decision is made, an existing ADR is superseded, or an ADR is reviewed.
---

# Write an ADR

Only for decisions that are hard to reverse or that a reviewer would question
(data model, hosting, security, money, tooling). Not for routine choices.

## Steps

1. **Research first.** Find the standard and the real options in quality
   sources (official docs, standards bodies, recognised authors) and save the
   notes in `docs/research/reports/`. Never call something a standard from
   memory (`AGENTS.md`, How we work 3).
2. **One decision.** If a part has its own options and could be reversed on
   its own, it is a separate ADR; link them.
3. List `docs/decisions/` and take the next number: `NNNN-short-title.md`
   (four digits, lowercase, hyphens). Numbers are never reused.
4. Copy `docs/decisions/adr-template.md` and fill it in. Delete the template
   comments and sections left empty (all but Context, Considered Options and
   Decision Outcome are optional).
5. Check it against the checklist below and fix what fails.
6. Add it to the decisions list in `README.md`.
7. An accepted ADR is never edited. To change a decision, write a new ADR and
   set the old one's status to `superseded by [NNNN](NNNN-title.md)`.

## Checklist

**Scope**

- One decision; the title names the problem and the chosen solution.
- Architecturally significant: hard to reverse or questioned in review.

**Structure (MADR 4.0.0)**

- Context in two to three sentences with the scope and the requirement.
- At least two real options, at the same level, the chosen one first; no
  dummy alternative that could never win.
- Outcome reads `Chosen option: "…", because …`, and the reason ties back to
  the drivers.
- Bad consequences are written down, including what a later change costs.
- Confirmation says how the code is checked against the decision.

**Content**

- One to two pages, full sentences. Not a design guide: details and research
  notes are linked. It still makes sense without them.
- Stays on topic. Review history ("we tried X") goes in `docs/ai-log.md`,
  unless X was a real option, then it is a considered option.
- Covers the views that matter: customer, staff, owner, operations.

**Evidence**

- Every claim and every adjective has a source in More Information, or goes.
  The wording matches the source ("recommends" is not "forbids").
- No pros-only story, no hidden costs, no fake precision.
- Assumptions and anything unverified are named.

## Sources

- MADR 4.0.0 template: https://raw.githubusercontent.com/adr/madr/4.0.0/template/adr-template.md
- Zimmermann, MADR primer: https://ozimmer.ch/practices/2022/11/22/MADRTemplatePrimer.html
- Zimmermann, ADR creation good practices and anti-patterns: https://ozimmer.ch/practices/2023/04/03/ADRCreation.html
- Zimmermann, ADR review: https://ozimmer.ch/practices/2023/04/05/ADRReview.html
- Zimmermann, definition of done (ecADR): https://www.ozimmer.ch/practices/2020/05/22/ADDefinitionOfDone.html
- Nygard, Documenting Architecture Decisions: https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- Microsoft Azure, ADR: https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record
- AWS, ADR process: https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html
- Research notes (local): `docs/research/reports/adr-writing-standards-2026-11.md`
