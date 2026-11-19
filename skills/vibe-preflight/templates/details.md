# vibe-preflight — technical details

**Project:** <name> · **Stack:** <framework, language, database, key services> · **Checked:** <YYYY-MM-DD> · **Scope:** <all / area / path> · **Previous run:** <date of details.previous.md / none>

> For the agent and any developer fixing the findings. The owner's summary is `report.md`.
> Keep private — `.vibe-preflight/` is git-ignored.

## Summary

| RED | YELLOW | INFO | Looks good |
| --- | --- | --- | --- |
| <n> | <n> | <n> | <n> |

## Since last check

<!-- Only if a previous run existed (SKILL.md step 4). Otherwise write "First run." -->

| Key | Change | Detail |
| --- | --- | --- |
| `<CHECK-ID>:<slug>` | fixed / new / level changed / still open / not rechecked (out of scope) | <what changed; for level changes, the adjustment code or the code change that explains it> |

## Coverage

<!-- Every item of every loaded checklist, in checklist order. Results:
     pass · finding <id> · n/a (why) · not checked (why) · ask owner (the question).
     Unloaded checklists: one row each. -->

| Check | Result | Note |
| --- | --- | --- |
| SEC-01 | pass | <what was searched> |
| SEC-02 | not checked | <e.g. folder is not a git repository> |
| SEC-03 | finding R3 | |
| SEC-04 | n/a | <e.g. no Supabase or Firebase> |
| … | | |
| agent-config.md | not loaded | <e.g. no .claude/, .mcp.json or .cursor/> |

## Findings

<!-- RED first, then YELLOW, then INFO; most damaging first within a level.
     R1, R2… numbering is for this run's order; the key is what stays the same across runs.
     One finding per fix: merge locations when one change fixes all, split when fixes differ. -->

### R1. <technical title>

- **Key:** `<CHECK-ID>:<short-slug>`
- **Level:** <RED> or e.g. <YELLOW (default RED, L-DEVONLY)>
- **Check:** <ID(s), e.g. DEP-02>
- **Where:** `path/to/file:line` (all locations if more than one)
- **What's wrong:** <precise technical description: advisory ids, affected and fixed versions, conditions>
- **Impact:** <what an attacker or failure can do, and to what>
- **Fix:**
  1. <exact change or command>
  2. <follow-up: rebuild, redeploy, rotate, migrate>
- **Owner action needed:** <none / what only the owner can do, e.g. change a password on the live server>
- **Evidence:** `<short snippet, secrets masked as sk-****, or **** if under 16 chars>`
- **Confidence:** <verified how / what was not verified and why>
- **Status:** OPEN <!-- becomes: FIXED — <what changed, files touched> -->

## Looks good

- <every positive check, with location>

## Open questions

- <what could not be determined from the code, and who could answer it>

## Server checks the owner can run

<!-- only when containers.md was loaded; keep the lines for the engine in use -->

```bash
docker ps --format '{{.Names}}\t{{.Ports}}'   # Docker: a database port showing 0.0.0.0: is open
podman ps --format '{{.Names}}\t{{.Ports}}'   # Podman: same check
loginctl show-user <user> -p Linger           # rootless Podman: "Linger=yes" = services start at boot
sudo ss -tlnp                                 # what the server is listening on
nc -zv <server-ip> 5432                       # from ANOTHER machine: "succeeded" = exposed
```
