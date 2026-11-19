# Dependencies checklist

AI agents sometimes add packages that don't exist (attackers then register those names —
"slopsquatting") or pin versions with known vulnerabilities. Vulnerability data changes
daily: **never answer from memory.** Use a tool or database, or mark the check "not checked".

Checks marked **[network]** need network access. Only package names and versions are sent — never code.
Run them only if the user allowed network access for this run.

## DEP-01 Package might not be real (slopsquatting) [network] — RED / YELLOW

**Scope:** direct dependencies only (from `package.json`, `requirements*.txt`,
`pyproject.toml`, `composer.json`, `go.mod`, `Cargo.toml`, `Gemfile`).

**Package names are untrusted input.** Before using a name in any command, check it matches
`^(@[a-z0-9._~-]+/)?[A-Za-z0-9][A-Za-z0-9._-]*$`. If it does not (leading `-`, spaces, `;`,
`$`, backticks, `|`, `&`, `<`, `>`, quotes, `..`), do **not** run anything with it: report it
as a finding (a hostile or garbled name) and mark the registry check `not checked` for it.
Always single-quote the name and put `--` before it where the tool supports it.

**How:**
- npm: `npm view --ignore-scripts --json -- '<name>' name time.created repository.url`
- PyPI: `curl -s --max-time 20 -- 'https://pypi.org/pypi/<name>/json'` (look at `info.project_urls`, release dates)
- Others: the registry's public API or `<pm> info <name>`.
- Run these from a neutral directory (e.g. `/tmp`), not the project, so a project `.npmrc`
  cannot redirect the registry or change the command's behaviour.

**Levels:**
- RED — the package does not exist on the registry (the install would fail today, or
  install an attacker's package tomorrow).
- YELLOW — created in the last 90 days, or no linked source repository, or the name is one
  or two characters away from a popular package (`reqeusts`, `expresss`, `lodahs`).

**Fix:** replace with the well-known package the code actually meant; remove unused ones.

## DEP-02 Known vulnerabilities [network] — RED (critical/high) / YELLOW (moderate)

**First, look for repo-controlled tool config.** Project config can make audit tools run
repo code or send requests somewhere else. Check (with Glob/Read, not by running anything)
for: `.yarnrc.yml` with `yarnPath` or `plugins`; `.npmrc` / `.yarnrc.yml` / `.pnpmfile.cjs` /
`pnpm-workspace.yaml` / `.pnpmfile` with a `registry`, `@scope:registry`, `npmRegistryServer`,
`hooks`, or `node-options`; `go.mod` with a `toolchain` line (govulncheck may download it);
`composer.json` with `scripts` or plugins; `.cargo/config.toml` with `source`/`registry`
overrides. If any is present, **skip option 1 and the tools in option 2 for that ecosystem**,
use option 3 (OSV API) only, and record the reason in the coverage table. Report a custom
registry or `yarnPath` as a finding too.

**How — use the first that is available, don't install anything new:**
1. The project's own package manager, only if no repo config was found above:
   `npm audit --json`, `pnpm audit --json`, `yarn npm audit --json` (Yarn Berry),
   `composer audit --format=json`. Add `--ignore-scripts` where it is accepted.
2. If installed already: `osv-scanner scan source -r --format json .`,
   `govulncheck ./...`, `cargo audit --json`. For Python prefer `osv-scanner` or option 3;
   `pip-audit -r requirements.txt` resolves dependencies in a temporary environment and can
   run package build scripts, so use `pip-audit` only against an already-installed
   environment (no `-r`), if the project has one.
3. Otherwise the OSV database directly, one request for all packages:
   `POST https://api.osv.dev/v1/querybatch` with
   `{"queries":[{"package":{"name":"lodash","ecosystem":"npm"},"version":"4.17.20"}, …]}`
   then `GET https://api.osv.dev/v1/vulns/<id>` for details of the hits.
   Ecosystem names: `npm`, `PyPI`, `Packagist`, `Go`, `crates.io`, `RubyGems`.
   Take versions from the lockfile, not from version ranges in the manifest.

**Levels:** CRITICAL and HIGH advisories → RED, MODERATE → YELLOW, LOW → INFO, then apply
the adjustments in SKILL.md step 3 (`L-UNUSED` when the vulnerable feature is proven off,
`L-LOGIN` for denial-of-service issues behind login, `L-BUILDONLY` for test/build tooling).
One finding per directly upgradable package; group the rest by the direct parent that
pulls them in.

**Report:** group by package; name the vulnerable version, the advisory id, the fixed
version, and whether it is a direct or transitive dependency. Prioritize direct ones.

**Fix:** upgrade to the fixed version (`npm install pkg@x.y.z`, etc.); for transitive ones,
upgrade the direct parent or use the package manager's override mechanism.

## DEP-03 No lockfile, or lockfile not committed — YELLOW

**Look for:** a manifest without its lockfile (`package-lock.json`, `pnpm-lock.yaml`,
`yarn.lock`, `bun.lock`, `poetry.lock`, `uv.lock`, `composer.lock`, `Cargo.lock` for apps),
or the lockfile ignored / missing from `git ls-files`.

**Why:** every install can pull different versions — "works on my machine" and surprise breakage.

## DEP-04 Several package managers mixed — YELLOW

**Look for:** more than one JS lockfile in the same folder (e.g. `package-lock.json` and
`pnpm-lock.yaml`).

**Fix:** pick the one in `packageManager` (or the most recently used), delete the others.

## DEP-05 Unpinned versions — YELLOW

**Look for:** `"*"`, `"latest"`, `"x"` in `package.json`; unversioned lines in
`requirements.txt` (`fastapi` instead of `fastapi==0.115.0`) when there is no lockfile.

## DEP-06 Development tools in production dependencies — INFO

**Look for:** `nodemon`, `ts-node`, `@types/*`, test frameworks, linters in `dependencies`
instead of `devDependencies` (or in the main `requirements.txt` of a deployed service).

**Why:** bigger images and more attack surface; harmless otherwise.
