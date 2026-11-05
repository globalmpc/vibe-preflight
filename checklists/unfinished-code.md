# Unfinished code checklist

Coding agents sometimes say "done" while leaving stubs, fake data or disabled checks
behind. Look for code that only *looks* finished.

## UNF-01 Placeholders in real code paths — YELLOW (RED in auth, payment, data deletion)

**Look for:** `TODO`, `FIXME`, `XXX`, `HACK`, "implement later", "not implemented",
`throw new Error('Not implemented')`, `raise NotImplementedError`, bare `pass` in route
handlers, functions that only `return` a constant.

Ignore placeholders in tests, examples and comments that describe future features
clearly marked as such.

## UNF-02 Fake data returned as if real — RED (payment, auth) / YELLOW

**Look for:** hard-coded arrays or objects returned from API routes or services that should
read a database or call a provider; `return { success: true }` without doing the work;
`setTimeout` used to simulate work; "mock", "dummy", "sample", "fake" data imported into
production code.

**Why:** the screen looks right, but nothing is saved or charged.

## UNF-03 Hard-coded users, passwords or admin bypass — RED

**Look for:** comparisons against literal emails or passwords (`email === 'admin@…'`,
`password == "123456"`), `isAdmin = true`, default admin accounts created on startup with a
fixed password, "master password" or "backdoor" logic.

## UNF-04 Security checks commented out or switched off — RED

**Look for:**
- auth middleware, guards or decorators commented out; `// TODO: re-enable auth`;
- flags such as `SKIP_AUTH`, `DISABLE_AUTH`, `AUTH_DISABLED`, `BYPASS_*` that are true by
  default or in production config;
- TLS checks turned off: `NODE_TLS_REJECT_UNAUTHORIZED = '0'`, `rejectUnauthorized: false`,
  `verify=False`, `InsecureSkipVerify: true`;
- CSRF protection disabled (`csrf_exempt` on state-changing views, `csrf: false`).

## UNF-05 Errors swallowed — YELLOW

**Look for:** empty `catch {}` / `catch (e) {}`, `except: pass`, `except Exception: pass`,
`.catch(() => {})` in flows that save data, charge money or send messages.

**Why:** when something fails, nobody — not the user, not the owner — finds out.

## UNF-06 Tests that test nothing — YELLOW

**Look for:** no test files at all; tests with no assertions; `expect(true).toBe(true)`;
`it.skip`, `xit`, `@pytest.mark.skip` on most tests; snapshot tests only.

## UNF-07 The agent cannot check its own work — INFO

**Look for:** no `test`, `lint` or `typecheck` script in `package.json` (or the equivalent
for the stack); type checking disabled (`"strict": false` plus widespread `any`,
`// @ts-nocheck`, `# type: ignore` everywhere).

**Why:** without a command that can fail, a coding agent has no way to notice it broke something.

## UNF-08 Sensitive data printed to logs — YELLOW

_Level: `H-SENSITIVE` applies (SKILL.md step 3) when the profile says sensitive data is stored._

**Look for:** `console.log`, `print`, `logger.*` that output passwords, tokens, full request
bodies of login/payment routes, or whole user objects.

## UNF-09 Leftover files — INFO

**Look for:** `*-old.*`, `*-backup.*`, `*copy*.*`, `utils2.*`, `test.js` / `temp.py` in the
source root, duplicated components or routes that are no longer used.
