@AGENTS.md

## Claude Code

- Skills: `/review-change` before every commit proposal, `/new-adr` for decisions.
- After scaffolding, add to `.claude/settings.json`: Prettier on every edited
  file and a Stop hook that requires `bun run typecheck` to pass.
- Deny rules block reading `.env*`, `git push` and deploys.
- `.claude/settings.local.json` and `CLAUDE.local.md` are personal and gitignored.
