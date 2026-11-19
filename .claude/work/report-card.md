# Report card (grade card, progress card, README badge)

**Status:** Review round 1 PASS (2 Should fix, 2 Suggestion notes; no further round needed).
**Base:** 587892a03002b2f9f8f1f2fc153f6e24a45be1f5

Requirements are in `report-card-prompt.md`. Where that file and this doc differ, this doc is the decision.

## Problem
vibe-preflight writes `report.md` and `details.md`, but nothing it produces can be shared. We need a grade card, a progress card and a README badge. A script must compute them from structured findings, not Claude's judgment, and they must never show specifics. The existing scan and report stay unchanged.

## Current state (evidence, implementer: re-verify line refs)
- **No machine-readable output.** Findings exist only as Markdown (`vibe-preflight/templates/details.md:43-57`, `templates/report.md`).
- **Three severity levels only:** RED, YELLOW, INFO (`vibe-preflight/SKILL.md:121-124`). There is no critical/high/medium/low.
- **Existing summaries:** details.md has `RED | YELLOW | INFO | Looks good` (`templates/details.md:10-12`). report.md has `Must fix first | Worth fixing soon | Already done well` (`templates/report.md:12-14`).
- **Checklist prefixes:** SEC, DEP, COST, UNF, RDY, DC, PLT, DF, AGT.
- **Install copies the whole skill folder.** `install.sh:65` runs `cp -r "$src/." "$dest/"`, so everything under `vibe-preflight/` ships and nothing outside it does. install.sh needs no change.
- **Outputs are already git-ignored.** `.vibe-preflight/.gitignore` is always overwritten with `*` (`SKILL.md:182-184`). That covers findings.json, the cards and history.
- **Nothing to build on:** no package.json, no tests, no scripts, no decision docs. `docs/` has only `demo/`.
- **Tool repo slug:** `install.sh:11` (`globalmpc/vibe-preflight`).
- **Rules to keep:** never install tools (`SKILL.md:52`); ask once (`SKILL.md:49-51`); the run ends with the fixes question (`SKILL.md:226-229`).

## Options considered
**PNG rendering**
1. **Chosen: vendor `@resvg/resvg-wasm@2.6.2` plus JetBrains Mono TTFs.** Researcher verified: MPL-2.0, no runtime deps, ships `index.mjs` and `index_bg.wasm` (~2.48 MB), supports `font.fontBuffers`. Nothing is installed at scan time; output is the same on every OS. Cost: ~3 MB of binaries in git and in each install.
2. Rejected: install resvg-wasm at scan time after asking (install path, network, version drift, extra test branch).
3. SVG only: no binaries, but SVG can't be posted on most social sites. **Lazier alternative if the user picks it: drop `vendor/` and the PNG step.**

**Category per finding:** Claude writes `category`; the script checks it against a fixed list. Not derived from check ids (would put ids in the file).

**Repo URL:** the vibe-preflight tool's own repo, read from the skill's own `package.json` `repository` field. No git-remote fallback: an installed copy has no `.git`, and `git -C ~/.claude/skills/...` could pick up the user's private dotfiles repo and print it on a public card.

## Decision

### 1. findings.json
Path: `.vibe-preflight/findings.json` (git-ignored by the existing `*` rule). It holds no titles, paths, keys, check ids, evidence or values. The script reads only allow-listed fields.

```json
{ "schema": 1, "project": "TaskNote", "scanDate": "2026-11-19", "fixed": 2,
  "findings": [ {"severity":"RED","category":"secrets","fixMinutes":15},
                {"severity":"YELLOW","category":"deployment","fixMinutes":30},
                {"doneWell":true,"category":"security"} ] }
```

- `schema` must be `1`.
- `project` sanitized: control chars removed, cut to 24 chars with `…`, then XML-escaped.
- `scanDate` must match `^\d{4}-\d{2}-\d{2}$`. Only date shown; the script never reads the clock.
- `fixed` = fixed count from step 4, or 0.
- `severity` is RED, YELLOW or INFO. `fixMinutes` integer 0..100000.
- `category` is one of: security, secrets, dependencies, cost, unfinished, deployment, agent.
- One entry per details.md finding, and one `doneWell` entry per "Looks good" bullet.

**Category rule (goes into SKILL.md):** `secrets` = any key, password or token stored or exposed (e.g. SEC-01/02/03, DC-07, AGT-04). Otherwise by checklist: security.md → security; dependencies.md → dependencies; cost-abuse.md → cost; unfinished-code.md → unfinished; deploy-readiness, containers, platforms, dockerfile → deployment; agent-config.md → agent.

**Card labels, fixed order:** Security, Secrets, Dependencies, Cost & abuse, Unfinished code, Deployment, Agent config.

**Invalid input:** exit 1, name only the field path (e.g. `findings[3].category`), never the value. Extra fields ignored and never printed.

### 2. Rubric (exported constants in the script, mirrored in `docs/grading.md`)
| Rule | Value |
|---|---|
| RED deduction | 20 |
| YELLOW deduction | 5 |
| INFO deduction | 1 |
| Bonus per done-well | 1 |
| Bonus cap | 5 |
| Max score with any RED | 69 |

Score = `100 − deductions + min(doneWell, 5)`, clamped 0..100; any RED caps at 69 (RED is the repo's "critical" → D or worse).

Grades (min score): A+ 97, A 90, B+ 85, B 80, C+ 75, C 70, D 60, F 0.

Examples: 1 RED → 69 D; 3 YELLOW + 2 INFO + 5 done-well → 88 B+; nothing found + 5 done-well → 100 A+; 13 RED → F.

**Verdict:** any RED → "Not ready for real users yet"; score ≥ 90 → "Ready for real users"; else "Almost ready: a few things worth fixing".
**Counts:** Must fix = RED; Worth fixing = YELLOW + INFO; per-category counts = problems only.
**Fix time:** sum of RED `fixMinutes`: 0 → `none`; <60 → `~N min`; else `~X h` rounded to nearest 0.5 (60 → `~1 h`, 75 → `~1.5 h`).
**Badge colour:** A brightgreen, B green, C yellow, D orange, F red.

### 3. Runtime and rendering
Node 18+, zero npm deps. Tests use `node:test` / `node:assert`.

SVG: 1080×1350 portrait, fixed coordinates, `font-family="JetBrains Mono, DejaVu Sans Mono, Menlo, Consolas, monospace"`, font-size ≥ 28, each line ≤ 960px assuming 0.6em/char. No time other than `scanDate`, no random ids, fixed attribute order, `\n` endings.

PNG: vendored resvg-wasm, `initWasm(readFileSync(wasm))`, `new Resvg(svg, { font: { fontBuffers: [Regular, Bold], loadSystemFonts: false, defaultFontFamily: 'JetBrains Mono', monospaceFamily: 'JetBrains Mono' }, fitTo: { mode: 'original' } }).render().asPng()`.

Grade card shows: project name, big grade, verdict, three counts, 7 category rows, "Est. fix time (must fix): …", "Scanned <date> · vibe-preflight v<version>", footer: repo URL + "search vibe-preflight on GitHub". Version from `vibe-preflight/package.json`; omitted if not `x.y.z`.

### 4. Files, history, progress, badge
Script: `vibe-preflight/scripts/report-card.mjs`. Exports `parseFindings`, `score`, `renderCard`, `renderProgress`, `badge`, `sanitizeRepoUrl`, plus constants `WEIGHTS`, `BONUS_PER`, `BONUS_CAP`, `RED_CAP`, `GRADES`. Usage: `node <skill>/scripts/report-card.mjs [projectDir]`. Reads `<projectDir>/.vibe-preflight/findings.json`, writes into `.vibe-preflight/`. Stdout carries only the badge snippet and files written.

Write safety: before writing, exit 1 if `.vibe-preflight`, `history/` or any output path is a symlink (`lstat`).

History: `.vibe-preflight/history/<seq4>-<scanDate>.json`, keys exactly `{schema, date, version, grade, score, mustFix, worthFixing, doneWell}`. No project name, categories or findings. Read only names matching `^\d{4}-\d{4}-\d{2}-\d{2}\.json$`, sorted; skip malformed. If last entry deep-equals the current summary it's a re-render: "previous" is the entry before it, nothing written. Otherwise write seq+1. Add a `ponytail:` comment (identical rescan counts as re-render; add run id if it matters).

Progress card: only when a previous entry exists; otherwise delete old progress files. Shows `<prev> → <cur>` grades; Must fix / Worth fixing / Done well as `a → b`; `Fixed: <fixed>`; `<prevDate> → <scanDate>`; same footer.

`sanitizeRepoUrl`: strip `git+`; `git@host:o/r(.git)` → `https://host/o/r`; parse with `new URL`, require `https:`; drop user, password, port, query, hash; strip trailing `.git` and `/`; path must match `^(/[A-Za-z0-9._~-]+)+$` else `null`. If `null`: card shows only "search vibe-preflight on GitHub", badge has no link.

Badge: `[![vibe-preflight: <grade>](https://img.shields.io/badge/vibe--preflight-<encodeURIComponent(grade)>-<color>)](<url>)`.

New `vibe-preflight/package.json`: `{"name":"vibe-preflight","version":"<latest git tag or 1.0.0>","private":true,"license":"MIT","repository":{"type":"git","url":"https://github.com/globalmpc/vibe-preflight"}}` (verify slug vs install.sh and LICENSE).

### 5. Consent and SKILL.md
Card is optional; runs bundled local code, no network, installs nothing. Permission is asked inside the existing single rule-7 question (still one question up front). findings.json is always written in step 5. Script runs only if user agreed and Node ≥ 18; otherwise one-line note. Fixes question stays last.

## Changes
1. `vibe-preflight/scripts/report-card.mjs` (new): Decision 1-4.
2. `vibe-preflight/scripts/vendor/` (new): `resvg/index.mjs`, `resvg/index_bg.wasm` unmodified from `npm pack @resvg/resvg-wasm@2.6.2` in an empty temp dir (check `npm view … dist.integrity`); `resvg/LICENSE` (MPL-2.0 text); `fonts/JetBrainsMono-{Regular,Bold}.ttf` + `OFL.txt` from the official JetBrains/JetBrainsMono release. Confirm font license is OFL 1.1. If anything can't be obtained or verified, **stop and report**; do not fall back to SVG-only on your own.
3. `vibe-preflight/package.json` (new).
4. `vibe-preflight/SKILL.md`, additions only: extend rule 7 question ("May I also draw a shareable report card at the end? It runs a small script bundled with this skill on your computer (Node, no network, nothing installed) and shows only a grade and counts, never what or where the problems are."); step 5 findings.json paragraph (schema, category rule, "no titles, paths, keys, check ids, evidence, names or values"); new step 5b "Report card (only if the user agreed)": run `node "<skill folder>/scripts/report-card.mjs" "<project root>"`, add ≤ 2 lines to the summary (card path; badge is self-reported), "only make a card for an app the user owns or has permission to scan", if Node missing/script fails say so in one line and continue. Step 6 unchanged.
5. `docs/grading.md` (new): the rubric as two parseable tables in `| name | number |` rows (Rule|Value, Grade|Minimum score); verdicts, counting rules, category mapping; "The badge is self-reported"; Rendering section (why wasm is vendored, versions, sha256 of wasm and both TTFs, licenses, command regenerating demo card).
6. `README.md`: "## Report card" after "## Use": `docs/demo/report-card.png` image at top, 2-3 lines, link to grading.md, badge snippet, "The badge is self-reported: it shows the owner's last scan, and nothing verifies it.", "Scan only apps you own or have permission to scan.", needs consent and Node 18+.
7. `docs/demo/report-card.{svg,png}` (new): generated from `test/fixtures/demo.json` (TaskNote, counts roughly like sample-report.md).
8. `test/report-card.test.mjs` + `test/fixtures/*.json` (new, repo root so they don't ship). Run `node --test test/`. Tests write only to `mkdtemp` folders. Fake secrets are inert canaries like `CANARY_SECRET_9f2c1e`; never real-looking tokens (`sk-`, `AKIA`, `ghp_`).

## Acceptance criteria
- **AC1 Determinism.** Same findings.json in two fresh temp dirs → same grade, byte-identical `report-card.svg` and `report-card.png`. Script contains no `Date.now`, `new Date()`, `Math.random`. Verify: test with `Buffer.equals` + grep.
- **AC2 No leak.** Fixture `leak.json` adds extra fields at both levels (`title`, `path`, `file`, `line`, `key`, `check`, `evidence`, `package`, `version`, `env`, `secret`) with canary values (`CANARY_TITLE_7a1`, `src/canary_path_7a1.ts`, `CANARY_SECRET_9f2c1e`, `CANARY_ENV_7a1`, `canary-pkg-7a1`). After a full run with existing history (both cards made), no canary in either SVG, stdout, any history file, or the PNG bytes read as latin1. Every history file has exactly the 8 allowed keys.
- **AC3 Invalid input never echoes values.** A canary as invalid `category`/`severity`/`scanDate` → exit 1, stderr names the field path, neither stderr nor stdout contains the canary, no card or history written.
- **AC4 Rubric and RED cap.** 1 RED → 69, D, "Not ready for real users yet"; 1 RED + 10 done-well ≤ 69 (D); 3 YELLOW + 2 INFO + 5 done-well → 88 B+; nothing + 5 done-well → 100 A+; 13 RED → F; loop RED 1..5 × doneWell 0..20 × YELLOW 0..3 never above D.
- **AC5 Docs match code.** Test parses both tables in `docs/grading.md`; must equal `WEIGHTS`, `BONUS_PER`, `BONUS_CAP`, `RED_CAP`, `GRADES` (in order). Changing a constant fails the test (reviewer demonstrates).
- **AC6 Progress and history.** Fresh temp dir: run 1 (2 RED → score 60, D) → `0001-<date>.json`, no progress card. Run 2 (0 RED, 3 YELLOW, 2 INFO, 5 done-well → 88 B+, `fixed: 2`, later date) → `0002-…`, progress SVG contains `D`, `→`, `B+`, `2 → 0`, `Fixed: 2`. Run 2 again → no `0003`, progress SVG byte-identical. Delete history and rerun → progress files removed.
- **AC7 Content and readability.** Grade SVG contains project name, grade, verdict, 3 counts, all 7 category labels in order, fix-time line, scanDate, `v<version>`, sanitized URL, "search vibe-preflight on GitHub". Every `font-size` ≥ 28 in both SVGs. Every `<text>`: chars × 0.6 × size ≤ 960 (test with `max.json`: 60-char name, 999 findings, > 100 h fix time). Project name `<script>&"'` appears only XML-escaped. Plus phone-screenshot check by eye.
- **AC8 URL sanitizing and badge.** `git+https://user:tok3n@github.com/o/r.git?x=1#y` → `https://github.com/o/r`; `git@github.com:o/r.git` → `https://github.com/o/r`; `http:`, `file:`, `javascript:` → `null`; `https://github.com/o/r"><x` → `null`; `badge('B+', url)` === `[![vibe-preflight: B+](https://img.shields.io/badge/vibe--preflight-B%2B-green)](https://github.com/o/r)`. Real package.json gives `https://github.com/globalmpc/vibe-preflight`.
- **AC9 Write safety.** If `.vibe-preflight/report-card.svg` or `history` is a symlink pointing outside the project, exit 1 and the target is unchanged.
- **AC10 Existing report unchanged.** `git diff 587892a -- vibe-preflight/templates vibe-preflight/checklists vibe-preflight/references docs/demo/sample-report.md docs/demo/demo.gif install.sh` is empty. SKILL.md diff only adds lines apart from the extended rule-7 sentence; step-5 report rules and step 6 untouched; fixes question still last.
- **AC11 SKILL.md wording.** Consent inside the single rule-7 question; findings.json paragraph forbids titles, paths, keys, check ids, evidence, values and includes schema + category rule; step 5b runs only after consent and with Node 18+, contains "only … apps the user owns or has permission to scan"; nothing installed.
- **AC12 Shipping, licenses, docs.** Files exist: script, `vendor/resvg/{index.mjs,index_bg.wasm,LICENSE}`, `vendor/fonts/{JetBrainsMono-Regular.ttf,JetBrainsMono-Bold.ttf,OFL.txt}`, `vibe-preflight/package.json`. `test/` outside `vibe-preflight/`. sha256 in grading.md match files. README section has image, grading.md link, snippet, self-reported note, "scan only apps you own…". Regenerating from `demo.json` reproduces `docs/demo/report-card.svg` byte-for-byte (`cmp`).
- **AC13 Test suite.** `CI=true node --test` (Node 24 rejects the `test/` arg) exits 0 on Node 18+, no network. (No tests existed before.)

## Out of scope
- vibe-bill results, hosted service, upload, public gallery.
- Updating cards after step-6 fixes (user rescans).
- Git remote as URL fallback.
- Embedding the font in the SVG (PNG is the canonical share file).
- Byte-identical LLM output for the same scan (AC10 guards templates/rules instead).
- Translating the card (stays English).
- CI workflow, lockfile, npm scripts.

## Risks
- ~3 MB binaries in git and every install (SVG-only alternative remains).
- Supply chain: opaque wasm in a security tool. Mitigation: unmodified upstream file, pinned version, recorded sha256 + npm integrity.
- **Unverified:** `initWasm(buffer)` under plain Node 18+. Implementer checks; stop if it fails.
- **Unverified:** JetBrains Mono license is OFL 1.1; implementer confirms from the release zip.
- Card "worth fixing" = YELLOW+INFO may differ from report.md's column (no defined rule there).
- If Claude adds titles to findings.json, output is still safe via allow-list (AC2); file is local and git-ignored.
- Wider fallback fonts could clip the SVG; check by eye.

## Log
- 2026-11-19 analis: explored repo; wrote analysis (returned as text, doc saved by main session). Researcher verified resvg-wasm 2.6.2 facts. AC1-AC13 written.
- 2026-11-19 implementer: built script, vendor (resvg-wasm 2.6.2, JetBrains Mono 2.304), package.json, SKILL.md, grading.md, README, demo card, tests. `node --test` 11/11 pass. Deviations: AC6 fixture counts (doc arithmetic gives F / A, not D / B+); `node --test test/` fails on Node 24 (use `node --test`).
- 2026-11-19 main: corrected AC6 fixtures (original arithmetic wrong: 2 RED+3 YELLOW=45 F) and test command per implementer; round 1 review next.
- 2026-11-19 reviewer round 1 (HEAD 587892a, working tree uncommitted): **PASS**. AC1-AC13 verified. `CI=true node --test` 11/11 on Node 24.22.2. AC5 mutation (RED_CAP 70, B+ 86) in a /tmp copy fails AC5, repo untouched. Demo SVG+PNG reproduce byte-for-byte. sha256 values match grading.md. AC10 diff empty. Progress card rendered in /tmp and checked by eye. Notes:
  - R1-1 (Should fix) `vibe-preflight/SKILL.md:241-242`: "No ... names ... in this file" conflicts with the required `project` name field. Say "package/variable/file names" or "apart from `project`".
  - R1-2 (Should fix) `vibe-preflight/scripts/report-card.mjs:36`: sanitizing strips C0/C1 controls but not bidi/zero-width chars (U+202A-202E, U+2066-2069, U+200B-200F), so the project name can flip the card text visually. Owner-supplied, low impact.
  - R1-3 (Suggestion) `report-card.mjs:114-115`: the URL line and "search..." line are only 35px apart at 28px, which looks tight on the PNG. The progress card has a large empty band (y 1010-1243).
  - R1-4 (Suggestion) AC2 test checks the stdout of the leak run but no failing run with leak extras. AC3 covers that path.
