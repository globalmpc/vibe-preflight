# Security checklist

Find ways an outsider — or another logged-in user — can read, change or delete data
they should not, or steal keys. Cite `path:line` for every finding. Mask secrets.

## SEC-01 Secrets written in code — RED

**Look for:** string literals assigned to names like `secret`, `token`, `password`,
`api_key`, `apiKey`, `private_key`, `client_secret`, and well-known key shapes:
`sk_live_`, `sk-proj-`, `sk-ant-`, `AKIA`, `ghp_`, `github_pat_`, `xoxb-`, `xoxp-`, `AIza`,
`-----BEGIN .*PRIVATE KEY-----`, connection strings with a password
(`postgres://user:pass@`, `mysql://…:…@`, `mongodb+srv://…:…@`, `redis://:pass@`).
Ignore obvious placeholders in `.env.example` (`your-key-here`, `changeme`, empty).

**Why:** anyone who sees the code — a teammate, a public repo, a leaked image — can use
the key, run up bills or read the database.

**Fix:** move the value to an environment variable, read it at runtime, and **rotate the
key at the provider** because it is already exposed.

## SEC-02 `.env` file committed to git — RED

**Look for:** `git ls-files | grep -E '(^|/)\.env($|\.)'` excluding `.env.example` /
`.env.sample`. Also history: `git log --all --diff-filter=A --name-only --format= -- '*.env' '*.env.*'`.

**Why:** a file deleted from git is still in its history; anyone with the repo can recover it.

**Fix:** remove from git (`git rm --cached`), add to `.gitignore`, rotate every value in it.
Mention that rewriting history is optional and does not help if the repo was ever public.

## SEC-03 Secrets sent to the browser — RED

**Look for:** environment variables with a public prefix — `NEXT_PUBLIC_`, `VITE_`,
`REACT_APP_`, `EXPO_PUBLIC_`, `PUBLIC_`, `NUXT_PUBLIC_` — whose name contains `SECRET`,
`PRIVATE`, `SERVICE_ROLE`, `TOKEN`, `PASSWORD`, or the key of a paid API (OpenAI, Anthropic,
Gemini, Stripe secret `sk_`). Also paid-API keys used directly in client components.

**Not a finding:** keys designed to be public — Supabase *anon* key, Stripe *publishable*
key (`pk_`), Firebase web config, Google Maps keys restricted by domain (say so as INFO).

**Why:** these prefixes copy the value into the JavaScript every visitor downloads.

**Fix:** move the call to a server route; keep the key server-side only; rotate it.

## SEC-04 Supabase / Firebase data open to everyone — RED

**Look for:**
- Supabase `service_role` key used in client code or a public env var.
- SQL migrations (`supabase/migrations/*.sql`) that `create table` in `public` without
  `enable row level security` for that table; policies with `using (true)` on sensitive
  tables for `anon`/`authenticated`.
- Firebase `firestore.rules` / `storage.rules` with `allow read, write: if true;` or
  `if request.auth != null` on data that belongs to one user.

**Why:** with these settings anyone can read or overwrite the whole table from the browser.

**Fix:** enable RLS and write per-user policies (`auth.uid() = user_id`); keep
`service_role` on the server only.

## SEC-05 One user can reach another user's data (IDOR) — RED

**Look for:** handlers that load, update, delete, export, download or share a record by an
id from the URL, query or body, **without** also checking that the record belongs to the logged-in user. Typical:
`findUnique({ where: { id: params.id } })`, `Model.objects.get(pk=id)`,
`SELECT … WHERE id = $1` with no `user_id`/`owner_id`/`org_id` condition and no ownership
check after loading. Deliberately public share links (random unguessable token, meant to be
opened by anyone) are not a finding.

**Why:** changing `/orders/41` to `/orders/42` shows someone else's order.

**Fix:** include the owner in the query (`where: { id, userId: session.user.id }`) or check
ownership before returning; return 404 when it doesn't match.

## SEC-06 Endpoints with no login check — RED

**Look for:** list every API route, server action and admin page. Flag routes that change
data (POST/PUT/PATCH/DELETE, server actions) or show private/admin data and have no auth
check — no middleware, no session lookup, no guard/decorator. Check that Next.js
`middleware` matchers actually cover the routes they are meant to protect.

**Why:** anyone on the internet can call these, no account needed.

**Fix:** add the project's existing auth check to each route; for admin routes also check
the role on the server, not only by hiding buttons in the UI.

## SEC-07 Weak login and session handling — RED / YELLOW

**Look for:**
- RED: passwords stored in plain text or hashed with `md5`, `sha1`, plain `sha256`.
- RED: JWT secret hard-coded or trivial (`"secret"`, `"changeme"`), `algorithms: ['none']`,
  `jwt.decode` used instead of verify, `verify=False`/`options={"verify_signature": False}`.
- YELLOW: session cookie without `httpOnly`, `secure` (in production) or `sameSite`;
  auth tokens kept in `localStorage`; password reset tokens that never expire, are not
  invalidated once used (the same link works twice), are stored unhashed, or stay valid
  after a newer one is issued.

**Fix:** bcrypt/argon2 for passwords; a long random secret from env; verify tokens with an
explicit algorithm; secure cookie flags; reset tokens that are random, stored hashed,
short-lived, deleted in the same step that sets the new password, and replaced when a new one
is requested.

## SEC-08 Injection — RED

**Look for:**
- SQL built from strings: template literals or `+` in `query(`, `execute(`, `raw(`,
  `$queryRawUnsafe`, `$executeRawUnsafe`, Python f-strings / `%` / `.format` in `cursor.execute`.
- Shell commands with user input: `exec`, `execSync`, `spawn(..., { shell: true })`,
  `subprocess.*(..., shell=True)`, `os.system`.
- `eval`, `new Function`, `vm.runIn*`, Python `eval`/`exec` on request data.

**Why:** a crafted input can read or delete the whole database or run commands on the server.

**Fix:** parameterized queries / the ORM's safe API; argument arrays without a shell;
remove `eval`.

## SEC-09 Untrusted HTML rendered (XSS) — YELLOW (RED if user-generated content)

**Look for:** `dangerouslySetInnerHTML`, `v-html`, `innerHTML =`, `{@html}`, `|safe` /
`mark_safe` in templates, markdown rendered to HTML without a sanitizer.

**Fix:** render as text, or sanitize with DOMPurify / bleach before rendering.

## SEC-10 CORS open to every site — RED / YELLOW

**Look for:** `origin: '*'`, `origin: true`, reflecting the request `Origin`,
`allow_origins=["*"]`, `Access-Control-Allow-Origin: *`.
RED when combined with credentials (`credentials: true`, `allow_credentials=True`) or
cookie auth; YELLOW otherwise.

**Fix:** list the real frontend origins explicitly.

## SEC-11 File uploads without limits — YELLOW

_Level: `H-SENSITIVE` applies (SKILL.md step 3) when the profile says sensitive data is stored._

**Look for:** upload handlers (multer, formidable, `request.files`, `UploadFile`) without a
size limit, without type checks, saving under the user-supplied filename, or saving into a
publicly served folder.

**Why:** someone can fill the disk, upload a script, or overwrite files with `../` names.

**Fix:** size limit, allowed types, generated filenames, store outside the web root or in
object storage.

## SEC-12 Server fetches any URL the user gives (SSRF) — YELLOW

**Look for:** server-side `fetch`/`axios`/`requests.get` where the URL comes from the
request ("import from URL", image proxy, webhook tester, link preview).

**Fix:** allow-list domains; block private IP ranges and cloud metadata (`169.254.169.254`).

## SEC-13 Payment and webhook callbacks not verified — RED

**Look for:** webhook routes (Stripe, Midtrans, Xendit, PayPal, GitHub, Clerk…) that act on
the payload without verifying the provider's signature or callback token, and that don't
handle the same event arriving twice.

**Why:** anyone can POST "payment succeeded" and get the order for free.

**Fix:** verify with the provider's documented signature/token method; store processed
event ids and ignore repeats; re-check the payment status with the provider's API for
money-moving actions.

## SEC-14 Errors leak internals — YELLOW

**Look for:** catch blocks that return the raw error or stack to the client
(`res.json(err)`, `res.status(500).send(e.stack)`, `return {"error": str(e)}` for unexpected
errors), framework debug pages enabled.

**Fix:** log the details on the server; return a generic message and an id.

## SEC-15 No brute-force protection — YELLOW

**Look for:** login, signup, password reset, OTP and "send verification" routes with no
rate limiting (no limiter middleware, no provider-level protection).

**Fix:** rate limit per IP and per account; lock out or slow down after repeated failures.

## SEC-16 Same secrets in development and production — YELLOW

**Look for:** the same value for `AUTH_SECRET`/`JWT_SECRET`/`SECRET_KEY`, database
passwords, storage keys, paid-API keys or SMTP credentials in the development env file and
the production one (`.env` vs `deploy/.env`, `.env.production`, etc.). Compare lengths and
equality only — never print the values.

**Why:** anyone who gets the developer's laptop copy (a backup, a screenshot, a shared
folder) can sign in to production or spend the production API budget.

**Fix:** a separate set of values for production; a separate, capped API key for development.
