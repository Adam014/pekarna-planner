@AGENTS.md

## Claude Code

- Skills: `/review-change` before every commit proposal, `/new-adr` for decisions.
- Hooks in `.claude/settings.json`: Prettier runs on every edited file, and
  `bun run typecheck` must pass before a turn can end (both skip until the app
  is scaffolded).
- Review agents in `.claude/agents/`; their regression set in
  `.claude/review-evals/` (run it after changing the agents).
- Deny rules block reading `.env*`, `git push` and deploys.
- `.claude/settings.local.json` and `CLAUDE.local.md` are personal and gitignored.
