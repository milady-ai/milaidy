# Milaidy Project Rules

## PR Discipline (learned from PR #30 review)

### Security — Always validate both sides
- When adding API endpoints, **validate PUT/PATCH the same as POST**. Never assume only one verb needs guards.
- When accepting commands (e.g., MCP stdio servers), **restrict to an allowlist** (npx, node, docker, etc.). Never pass user input directly to shell execution.
- When accepting file paths or IDs from the client (skill uninstall, install records), **validate the resolved path stays within the expected directory**. Assume tampered input.
- When handling deep links or URL parameters (`milaidy://connect?url=`), **validate the protocol** (https only) to prevent SSRF.

### Wiring — Finish what you start
- If you construct a value (token snippet, config object, injection payload), **verify it's actually used**. Assigning to a variable and never passing it downstream = broken feature that silently does nothing.
- When adding query parameters parsed with `parseInt`, **always handle NaN** (`parseInt(val, 10) || defaultValue`).

### Endpoints — Mirror validation
- If a POST endpoint has validation (command allowlist, URL checks, Zod schema), the corresponding PUT endpoint **must have the same validation**. Copy-paste the guards or extract a shared validator.

### Large PRs — Merge awareness
- When your PR touches core files (`app.ts`, `api-client.ts`, `server.ts`, `eliza.ts`) and main has diverged significantly, **rebase before requesting review** to catch integration issues yourself.
- After rebasing, **check template literals** in Lit/HTML renders — merged code can end up inside string boundaries and render as raw text instead of executing.
- After rebasing, **check for duplicate method declarations** in classes — if both branches added methods to the same file, the merge may keep both copies with conflicting return types.

## Project Conventions

### Commit style
- Conventional commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Keep scope in parens when targeting a subsystem: `fix(ui):`, `security(mcp):`

### Key files (high merge-conflict risk)
- `apps/ui/src/ui/app.ts` — main UI component, very large, many contributors touch it
- `apps/ui/src/ui/api-client.ts` — API client methods, duplicates easily on merge
- `src/api/server.ts` — all API routes, grows fast
- `src/runtime/eliza.ts` — runtime config and startup

### Testing
- E2E tests use Playwright in `apps/ui/e2e/`
- Unit tests co-located with source (`*.test.ts`)
- CI runs Playwright as non-blocking (continue-on-error) with 30m timeout
