# Restructure into a Claude Code plugin

**Status:** Review round 1 PASS (uncommitted; ready for commit by main session).
**Base:** 203279c7bd0da3667abc8e54e8af90401b457eab
**Branch:** `plugin-structure` (already created). Commit is done by the main session after review PASS; implementer does NOT commit or push.

Requirements: the task prompt pasted by the user (summarised below). Where this doc and that prompt differ, this doc is the decision.

## Problem
The repo ships one skill, `vibe-preflight` (confirmed: `vibe-preflight/SKILL.md` frontmatter `name: vibe-preflight`; `install.sh` `name=vibe-preflight`). Its folder sits at the repo root (`vibe-preflight/`). It must become a plugin (`skills/vibe-preflight/`, `.claude-plugin/plugin.json`) for the `globalmpc/vibe-tools` marketplace and Anthropic's community directory. Skill behaviour must not change.

Note: `git remote -v` says `mustcompany/vibe-preflight-private`; every URL in the repo (install.sh, README, package.json) says `globalmpc/vibe-preflight`. Use `globalmpc/vibe-preflight` as the prompt says.

## Inventory (before any move)
Everything under `vibe-preflight/` is the skill and moves as one folder with `git mv vibe-preflight skills/vibe-preflight` (needs `mkdir skills` first):
- `SKILL.md`
- `checklists/*.md` (9 files), `references/dockerfile/*.md` (4), `templates/{details,report}.md`
- `scripts/report-card.mjs`, `scripts/vendor/{fonts/*.ttf + OFL.txt, resvg/{LICENSE,index.mjs,index_bg.wasm}}`
- `package.json` (version 1.0.0, `repository`; read by `report-card.mjs:177` as `join(here,'..','package.json')`, so it must stay one level above `scripts/`, i.e. inside the skill folder. It already is.)

Stay at the repo root (not used by the skill at runtime): `README.md`, `LICENSE` (MIT, Rickard Elsen), `install.sh`, `docs/` (grading.md + demo images), `test/` (test + fixtures), `.claude/work/` (handoff docs).

References to the old path `vibe-preflight/` that the move breaks:
- `install.sh`: lines 18-19 (`$here/$name/SKILL.md`, `src=$(cd "$here/$name"...)`), line 27 (`src=$tmp/$name`), line 28 error message (`No $name/SKILL.md`).
- `test/report-card.test.mjs`: line 9 (import), line 12 (`script`), line 14 (`package.json`), plus any other `vibe-preflight/scripts` or `vibe-preflight/package.json` path (grep, ~7 more).
- `docs/grading.md`: lines 3, 60, 76 (`vibe-preflight/scripts/...`).
- No CI (`.github/` does not exist). No other install scripts.
- NOT to change: `.vibe-preflight/` (the user-project output folder; different thing), `.claude/work/report-card.md` (historical doc, contains old paths on purpose), git history.

`SKILL.md` itself has no hard-coded path: it says `node "<skill folder>/scripts/report-card.mjs"` and uses relative `checklists/`, `templates/`, `references/`. These keep working both as a plugin and as a manual copy. No SKILL.md logic change.

## Official-docs check (read 2026-11-19: plugins-reference/manifest, create-marketplace, host-marketplace, loading)
Findings that matter, and where they differ from the prompt:
1. Only `name` is required in plugin.json; prompt's fields (`description`, `version`, `author{name}`, `homepage`, `repository`, `license`, `keywords`) are all valid. No conflict.
2. `claude plugin validate` warns on a non-kebab `name` and on missing `version/description/author`. We set all of them.
3. **Version pins updates.** If `version` is set in plugin.json, users only get a new copy when that string changes, however many commits are pushed. So every release must bump `version` (see "Releasing"). The prompt's version number is fine, but the Releasing note must say this. Also: do not set `version` in both plugin.json and the marketplace entry in `globalmpc/vibe-tools` (plugin.json wins, validate reports a mismatch). Tell the user in the final summary.
4. The plugin is copied whole into `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`; files outside the plugin dir are not copied. We have none outside it that the skill needs, so no decision needed (prompt step 3's TypeScript/Bun case does not apply).
5. Namespacing confirmed: plugin skill = `/<plugin>:<skill>` = `/vibe-preflight:vibe-preflight`.
6. Manual install target: a `SKILL.md` folder in `~/.claude/skills/vibe-preflight/` is the plain-skill path. Do not copy `.claude-plugin/` there (a skills dir with `.claude-plugin/plugin.json` would load as a `@skills-dir` plugin instead).
7. Optional directory-listing fields exist in plugin.json for the Anthropic directory submission (`icon`, `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`). Out of scope here; mention to the user only.
8. Reserved-name check passes: `vibe-preflight` does not start with `claude-`/`anthropic-`.

## Decision
1. `mkdir skills && git mv vibe-preflight skills/vibe-preflight`. Nothing else moves.
2. Create `.claude-plugin/plugin.json` exactly:
```json
{
  "name": "vibe-preflight",
  "description": "Pre-flight check for an app built with AI before you launch it: finds leaked keys, missing logins, risky packages, runaway costs, unfinished code and deploy mistakes, explained in plain words.",
  "version": "1.0.0",
  "author": { "name": "Global MPC" },
  "homepage": "https://github.com/globalmpc/vibe-preflight",
  "repository": "https://github.com/globalmpc/vibe-preflight",
  "license": "MIT",
  "keywords": ["vibe-coding", "claude-code", "skill", "security", "pre-flight", "deploy-readiness", "docker"]
}
```
   Version 1.0.0 = current `skills/vibe-preflight/package.json` version. Keep the two in sync (package.json feeds the version label on the report card).
3. Fix paths in `install.sh`, `test/report-card.test.mjs`, `docs/grading.md` (see inventory). `install.sh` keeps its `--target claude|codex|opencode|all` behaviour; only the source dir changes to `skills/vibe-preflight`. Known limit (note in handoff, do not fix): `install.sh --ref <old tag or branch>` for a ref that predates this layout will fail with the "No ... SKILL.md" error.
4. Do NOT touch `SKILL.md` frontmatter or logic. Do not add `/vibe-preflight:vibe-preflight` into its `description` (that would change what triggers it). SKILL.md has no text that tells users which command to run (only the description line "when the user runs /vibe-preflight"), so there is nothing to update there.
5. README:
   - Replace ONLY the `## Install` section (from `## Install` up to but excluding `## Use`). New content:
     ```
     ## Install

     ### Install (recommended)

     /plugin marketplace add globalmpc/vibe-tools
     /plugin install vibe-preflight@vibe-tools

     (in a code block, as in the prompt)

     ### Manual install
     ```
     Manual install keeps the existing `install.sh` instructions (curl and clone; Claude Code + Codex + OpenCode) because that is how Codex/OpenCode users install, and adds the plain-copy option for Claude Code: `mkdir -p ~/.claude/skills && cp -r skills/vibe-preflight ~/.claude/skills/` (from a clone). Keep the "Run it again to update" sentence.
   - Command name: the install paragraph, the first usage block near the top (`/vibe-preflight`) and the `## Use` block must show both, e.g. "installed as a plugin: `/vibe-preflight:vibe-preflight`; manual install: `/vibe-preflight`". Keep it to one added line or a short note, do not rewrite the blocks. Codex (`$vibe-preflight`) text stays.
   - Add a short `## Releasing` section before `## License` (maintainer note): to ship a new version to plugin users, bump `version` in `.claude-plugin/plugin.json` (and `skills/vibe-preflight/package.json`, which feeds the report card label) in the release commit, then push. Users stay on their cached copy until that string changes (omitting `version` entirely would instead track every commit; we pin on purpose). Users get it via `/plugin marketplace update vibe-tools` or auto-update if they turned it on (off by default for third-party marketplaces). Do not set `version` in the `vibe-tools` marketplace entry. 4-6 lines max.
6. No `marketplace.json` here. No push, no PR.

## Acceptance criteria
- AC1: `git mv` used; `git log --follow skills/vibe-preflight/SKILL.md` still shows history. `git status` shows renames (R), not delete+add, for the skill files.
- AC2: Final layout = `.claude-plugin/plugin.json`, `skills/vibe-preflight/**`, `README.md`, `LICENSE`, plus pre-existing `docs/`, `test/`, `install.sh`, `.claude/work/`. No `vibe-preflight/` folder left at the root.
- AC3: `grep -rn "vibe-preflight/\(scripts\|SKILL\|package\|checklists\|templates\|references\)" . --exclude-dir=.git --exclude-dir=node_modules` returns nothing outside `.claude/work/report-card.md` and `skills/` internal text; `grep -rn '\$here/\$name\|src=\$tmp/\$name' install.sh` returns nothing.
- AC4: `claude plugin validate .` last line is `✔ Validation passed` (warnings acceptable only if reported and explained; try `--strict` and report).
- AC5: Existing tests pass: `CI=true node --test test/` (non-interactive, once).
- AC6: Manual-install check: copy `skills/vibe-preflight/` into a temp `$HOME/.claude/skills/`, then (a) every relative file SKILL.md mentions (`checklists/*`, `templates/*`, `references/dockerfile/*`) exists there, (b) `node <copy>/scripts/report-card.mjs <tmpproject>` with `test/fixtures/demo.json` as `.vibe-preflight/findings.json` produces the card files. Also run `bash install.sh --target claude` with `HOME` set to a temp dir (install.sh uses `$HOME`) and confirm `.claude/skills/vibe-preflight/SKILL.md` exists. Use temp dirs only; never touch the real `~/.claude`.
- AC7: Plugin load test: try `claude --plugin-dir . -p "List the skills available from the vibe-preflight plugin, names only."` once (non-interactive; costs one short model call; do not pass flags that bypass permissions). If it cannot run, write the exact manual steps in the Log. Expect the skill listed as `vibe-preflight:vibe-preflight`.
- AC8: plugin.json matches the Decision exactly (description may be improved but must stay one plain-language line); `SKILL.md` is byte-identical to the base except for the move (`git diff -M --stat` shows 100% rename).
- AC9: README: only the Install section replaced, command name shown both ways, Releasing section added; `git diff README.md` shows no other changes.

## Out of scope
- Any change to skill logic, checks, report card or features; `SKILL.md` content.
- `marketplace.json`, the `vibe-tools` repo, push, PR, submitting to Anthropic.
- Fixing `install.sh --ref <old ref>`; old paths inside `.claude/work/report-card.md`.
- Directory-listing fields (`icon`, `privacyPolicyUrl`, ...).
- The untracked `report-card-prompt.md` and `.claude/agent-memory/` (leave untouched, do not stage).

## Risks
- A `.claude-plugin/` copied into `~/.claude/skills/` by a manual install would turn it into a skills-dir plugin: manual instructions must copy only `skills/vibe-preflight/`.
- Version pinning: forgetting to bump `version` means plugin users never see updates (documented in Releasing).
- The two version strings (plugin.json, skills/vibe-preflight/package.json) can drift; mentioned in Releasing.
- `claude --plugin-dir . -p` may need permission to run; if it hangs or fails, do not retry in a loop, log it.

## Log
- 2026-11-19 main session: inventory + docs review done, handoff written, `analis` skipped (root cause and fix already clear).
- 2026-11-19 implementer: DONE, not committed. `git mv vibe-preflight skills/vibe-preflight` (24 files, all staged as 100% renames); created `.claude-plugin/plugin.json` (exact Decision text, untracked); paths fixed in `install.sh` (4 lines: `skills/$name`), `test/report-card.test.mjs` (4 paths), `docs/grading.md` (3 paths); README: Install section replaced (recommended + manual, Option 3 plain copy), command shown both ways (line 16 comment, note under `## Use`), `## Releasing` added. SKILL.md untouched.
- Results: AC1 pass for renames (24x `rename 100%`); `git log --follow` shows nothing until the rename is committed (staged only), recheck after commit. AC2 pass (no root `vibe-preflight/`). AC3 pass (only `.claude/work/*` docs and new `skills/...` paths match; `$here/$name` grep empty). AC4 pass: `claude plugin validate .` last line `✔ Validation passed`; `--strict` also `✔ Validation passed`; one directory warning ICON_MISSING (no icon; out of scope, optional). AC5 pass with caveat: `CI=true node --test test/` fails on Node v24.22.2 (treats `test/` as a module: "test failed", 0 pass); `node --test test/report-card.test.mjs` gives 11/11 pass. AC6 pass (all SKILL.md-referenced files exist in copy; report-card.mjs wrote svg+png; `HOME=<tmp> bash install.sh --target claude` installed SKILL.md; temp dirs only). AC7 pass: `claude --plugin-dir . -p` listed `vibe-preflight:vibe-preflight`. AC8 pass: SKILL.md blob hash identical to base; plugin.json exact. AC9 pass (README diff limited to Install, command-name notes, Releasing).
- Incident: I ran an unrequested `git stash` once by mistake, then restored with `git stash pop --index`; state verified identical (24 R staged, 4 modified, stash empty).
- Known limit: `install.sh --ref <ref older than this layout>` fails with "No skills/vibe-preflight/SKILL.md".

## Manual test steps (for the user)
1. `claude --plugin-dir /home/ainx/mustcomp/vibe-preflight`, then `/vibe-preflight:vibe-preflight` in a small project; check `.vibe-preflight/report.md` appears.
2. Plain skill: `mkdir -p ~/.claude/skills && cp -r skills/vibe-preflight ~/.claude/skills/`, then `/vibe-preflight` (do not copy `.claude-plugin/`).
3. After commit: `git log --follow skills/vibe-preflight/SKILL.md` shows pre-move history.
4. Marketplace flow: after `globalmpc/vibe-tools` lists the plugin, `/plugin marketplace add globalmpc/vibe-tools` then `/plugin install vibe-preflight@vibe-tools`.
- 2026-11-19 reviewer round 1 (reviewed HEAD 203279c + uncommitted working tree): **PASS**. AC1-AC9 verified independently. AC4 validate and --strict both `✔ Validation passed`. AC5: `CI=true node --test test/` fails 0/1 identically at base 203279c (temp worktree), so it was already failing before the move (Node v24 directory form); `node --test test/report-card.test.mjs` 11/11. AC6 rerun in temp HOME ok. AC7 rerun: `vibe-preflight:vibe-preflight` listed. SKILL.md blob 579e920 identical at base, index, worktree.
  - R1-1 (Should fix) AC5 command: the test command fails before and after this change. Use `node --test test/*.test.mjs` (or the file path) in docs/ACs. Not caused by this change.
  - R1-2 (Suggestion) README.md Option 3: "Run it again to update" needs `git pull` first for the plain-copy option, and `cp -r` does not remove deleted files.
