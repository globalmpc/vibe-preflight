# Coding-agent configuration checklist

Settings files decide what a coding agent may do on the developer's machine without
asking. Vibe coders often click "Yes, and don't ask again" until the agent can do almost
anything, and repos copied from templates can ship hooks that run commands automatically.

**Files to read (workspace only — never read `~/.claude/` unless the user asks):**
- `.claude/settings.json` — shared; usually committed to git
- `.claude/settings.local.json` — personal; Claude Code writes "don't ask again" approvals
  here as `allow` rules, so risky permissions pile up here most often
- `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` — MCP server definitions
- any script a hook or `apiKeyHelper` points to (read it)

**Never edit these files during the audit, and never without an explicit yes** — they
control the agent's own permissions. Propose an exact diff instead.

## AGT-01 Hooks that fetch or run code from the internet, or send data out — RED

**Look for:** in `hooks`, or in scripts they call: `curl … | sh`, `wget -O- … | bash`,
`base64 -d | sh`, `eval "$(curl …)"`, `npx`/`uvx` of an unfamiliar package, uploads with
`curl -d @file` / `--data-binary`, reads of `~/.ssh`, `~/.aws`, `~/.config`, browser
profiles, or `env`/`printenv` piped to the network.

**Why:** hooks run automatically on every matching event; a malicious hook in a cloned repo
runs on the developer's machine with their permissions.

## AGT-02 Unlimited shell permission — RED

**Look for:** in `permissions.allow`: `"Bash"` with no pattern, `"Bash(*)"`, `"Bash(sudo *)"`,
`"Bash(rm *)"`, `"Bash(chmod *)"`, `"Bash(chown *)"`, `"Bash(dd *)"`. Older rules may use the
`Bash(cmd:*)` form — treat it the same as `Bash(cmd *)`.

**Fix:** allow specific commands instead (`Bash(npm run test *)`, `Bash(npm run lint)`).

## AGT-03 Permissions that look narrow but reach far — YELLOW

**Look for:** allow rules for:
- `npx`, `bunx`, `pnpm dlx`, `uvx`, `pipx run`, `npm install *`, `pip install *` — can download
  and run any package, including hallucinated ones (see DEP-01);
- `docker *` — equivalent to root on the host;
- `curl *`, `wget *` — can download scripts and send data out;
- `git push *` (especially with `--force`), `git reset --hard *`, `git clean *`;
- deploy and infrastructure CLIs: `vercel --prod`, `fly deploy`, `kubectl`, `terraform apply`,
  `aws`, `gcloud`, `ssh`, `scp`, `rsync` to remote hosts;
- database clients pointed at production (`psql`, `mysql`, `mongosh` with a remote URL).

**Fix:** move them to `ask`, or narrow them to the exact command.

## AGT-04 Secrets in agent config — RED if the file is tracked by git, YELLOW otherwise

**Look for:** tokens or keys in the `env` block of `.claude/settings*.json`; in `.mcp.json`
`env` or `headers` (`Authorization: Bearer …`, `API_KEY`, `GITHUB_TOKEN`); an `apiKeyHelper`
that prints a literal key. Check tracking with `git ls-files`.

**Fix:** reference environment variables instead of literal values; rotate exposed keys.

## AGT-05 Personal settings shared with everyone — YELLOW

**Look for:** `.claude/settings.local.json` listed in `git ls-files`.

**Why:** one person's "don't ask again" approvals become everyone's. Claude Code keeps this
file out of git only when it creates the file itself; a hand-made one must be ignored manually.

**Fix:** `git rm --cached .claude/settings.local.json` and add it to `.gitignore`.

## AGT-06 Access outside the project — YELLOW

**Look for:** `permissions.additionalDirectories` containing `~`, `/`, the home directory,
`..`, or folders unrelated to the project.

## AGT-07 Agent allowed to read `.env` files — YELLOW

**Look for:** no `deny` rules for environment files. Claude Code's documentation shows
`"deny": ["Read(./.env)", "Read(./.env.*)"]` as an example.

**Why:** secrets read by the agent end up in conversation logs and may be pasted elsewhere.

## AGT-08 Unknown MCP servers — YELLOW

**Look for:** MCP servers launched with `npx`/`uvx` from packages that are not well known
(apply the DEP-01 check if network access is allowed), remote MCP URLs on unfamiliar
domains, servers given broad filesystem or shell access.

## AGT-09 Bypass mode set in project files — INFO

**Look for:** `permissions.defaultMode` set to `bypassPermissions` or `auto` in
`.claude/settings.json` or `.claude/settings.local.json`.

**Report as INFO, not a risk:** current Claude Code ignores these two values in project and
local settings (they only take effect from user or managed settings, or a command-line
flag). Suggest removing the line to avoid confusion.

## Context to include in the report

Allow rules, `additionalDirectories` and most `env` values in the shared
`.claude/settings.json` only take effect after the user trusts the folder; `deny` and `ask`
rules apply immediately. So the real risk with a cloned repo is trusting the folder without
reading this file first — say that in plain words.
