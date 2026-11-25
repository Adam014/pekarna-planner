---
status: accepted
date: 2026-11-25
---

# A sober design system on shadcn/ui

## Context and Problem Statement

Staff use the app all day on a tablet by the phone, the baker prints the plan,
and the owner checks it on a phone. Every screen should look the same without
each one inventing its own spacing, colours and sizes.

## Considered Options

- shadcn/ui (Radix) with project tokens in CSS variables
- A component library with its own styling (MUI, Mantine)
- Hand-written components on plain Tailwind

## Decision Outcome

Chosen option: "shadcn/ui with project tokens", because the components are
copied into the repo and can be adjusted to the project rules (14 px minimum
text, 44 px touch targets, pointer cursor), they build on accessible Radix
primitives, and the look is defined by a small set of CSS variables. The style
is a sober internal tool: warm neutrals, a near-black primary, a single
"crust" accent and four status colours for reservation states. Allo (SIL Open
Font License) is the text font. Dark mode follows the system setting with
plain CSS, so no theme library or inline script is needed.

### Consequences

- Good, because a new screen reuses the same tokens and components, and
  `/design` shows them in one place.
- Good, because the components are plain code in the repo that the review can read.
- Bad, because components added later with the shadcn CLI come with their
  default sizes and must be raised to the project rules.

## More Information

- shadcn/ui: https://ui.shadcn.com/docs
- shadcn/ui theming with CSS variables: https://ui.shadcn.com/docs/theming
- Tailwind CSS dark mode with `prefers-color-scheme`: https://tailwindcss.com/docs/dark-mode
- WCAG 2.2 target size: https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- SIL Open Font License: https://openfontlicense.org
