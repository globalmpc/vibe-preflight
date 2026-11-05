# Hosting platforms checklist (Vercel, Netlify, Cloudflare, Render, Railway, Fly.io)

Many vibe-coded apps never touch a server: they are pushed to a hosting platform. The
platform removes server chores but brings its own traps — files that vanish, databases that
run out of connections, previews that expose real data.

## First: which platform and which model

| What you find | Platform | Model |
| --- | --- | --- |
| `vercel.json`, `.vercel/`, docs mention Vercel | Vercel | serverless functions |
| `netlify.toml`, `netlify/functions/` | Netlify | serverless functions |
| `wrangler.toml` / `wrangler.jsonc` | Cloudflare Workers / Pages | edge functions — no filesystem, no Node.js built-ins unless enabled |
| `render.yaml` | Render | long-running service; local disk is temporary unless a persistent disk is attached |
| `railway.json` / `railway.toml` | Railway | long-running service; local disk is temporary unless a volume is attached |
| `fly.toml` | Fly.io | long-running machines; local disk is temporary unless a volume is mounted |

Vercel, Netlify and Cloudflare: apply every item. Render, Railway and Fly.io: apply PLT-01
(temporary disk), PLT-06, PLT-07, PLT-08 and PLT-09; apply PLT-02 to PLT-05 only if the app
runs as functions there.

The agent cannot see the platform's dashboard. Items marked **[owner check]** are always
recorded as `ask owner` in the coverage table and turned into a plain question in the report.

## PLT-01 Files saved to the app's own disk — RED

**Look for:** code that writes files the app needs later — uploads saved with `fs.writeFile`
/ `createWriteStream` / `open(..., 'w')`, paths like `public/uploads`, `./uploads`,
`path.join(process.cwd(), ...)`; SQLite database files; generated files served later.

**Why:** on these platforms the app's disk is temporary or read-only. Saved files disappear
on the next deploy or restart — or the save fails outright — usually without any error the
user sees.

**Fix:** object storage (Vercel Blob, S3, Cloudflare R2, Supabase Storage, UploadThing) for
files; a hosted database instead of SQLite; on Render/Railway/Fly.io, a persistent volume
if the app truly needs a disk.

## PLT-02 Database connections without pooling — YELLOW

**Look for (serverless only):** a direct Postgres/MySQL connection (`DATABASE_URL` on port
`5432`/`3306`, no pooler host) used from functions with Prisma, Drizzle, `pg`, `postgres`,
`mysql2`; a new database client created inside the request handler.

**Judge by host and port, not by flags.** `pgbouncer=true` is only a Prisma setting; it
does not make a direct connection pooled.

**Not a finding:** Supabase **transaction** pooler (`*.pooler.supabase.com:6543`), Neon
`-pooler` hosts, Prisma Accelerate, HTTP-based drivers (Neon serverless, PlanetScale).
Supabase **session** pooler (`*.pooler.supabase.com:5432`) works but is not meant for
serverless — suggest the transaction pooler as INFO. A direct `db.<ref>.supabase.co:5432`
URL is a finding.

**Why:** every function instance opens its own connections. Under real traffic the database
hits its connection limit and the whole app starts failing.

**Fix:** use the provider's pooled connection string for the app; keep the direct one for migrations.

## PLT-03 Background work that needs an always-on process — YELLOW (RED if a core feature depends on it)

**Look for (serverless only):** in-process schedulers (`node-cron`, `setInterval` jobs,
`agenda`), queue workers started inside the web app (BullMQ `Worker`), WebSocket servers
(`socket.io`, `ws`) started by the app, promises started but not awaited after the response
is sent ("fire and forget").

**Why:** a serverless function only lives while it handles a request. Scheduled jobs never
run, workers stop mid-task, and unawaited work is frozen or dropped.

**Fix:** the platform's cron (`crons` in `vercel.json` — on the Hobby plan only once a day,
more frequent schedules need a paid plan or an external scheduler; Netlify scheduled
functions; Cloudflare Cron Triggers), a separate worker service, a managed queue, or the platform's
"run after response" API (`after()` in Next.js, `waitUntil`).

## PLT-04 Work longer than the function time limit — YELLOW

**Look for (serverless only):** inside request handlers — LLM calls without streaming, PDF
or image generation, video or audio processing, large imports or exports, scraping loops;
no `maxDuration` (or platform equivalent) where such work exists.

**Why:** functions are stopped after the plan's time limit; the user sees a timeout and the
work is lost halfway.

**Fix:** stream responses; move heavy work to a background job; set the duration limit
explicitly within the plan.

## PLT-05 State kept in memory between requests — YELLOW

**Look for (serverless only):** module-level `Map`/objects/arrays used as a rate limiter,
session store, cache, counter or queue (`const hits = new Map()`), in-memory rate-limit
libraries without an external store.

**Why:** each function instance has its own memory and instances come and go, so the limit
or session is silently reset. A rate limiter built this way does not actually limit — count
it as missing for SEC-15 and COST-02.

**Fix:** keep the state in Redis (Upstash, or another Redis integration from the platform's
marketplace) or the database.

## PLT-06 Secrets in platform config files — RED

**Look for:**
- `.env.local` / `.env.development.local` created by `vercel env pull`, tracked by git;
- literal secrets in `netlify.toml` `[build.environment]` / `[context.*.environment]`,
  `wrangler.toml` `[vars]`, `fly.toml` `[env]`, `render.yaml` `envVars` with `value:`;
- `.vercel/` tracked by git (not secret by itself, but a sign that pulled env files may be too).

**Why:** these files are usually committed; anything in them is visible to everyone who
can see the repository.

**Fix:** keep secrets in the platform's secret store (Vercel/Netlify environment variables,
`wrangler secret put`, `fly secrets set`, Render secret env vars) and reference them by name;
rotate any value that was committed.

## PLT-07 Source code published through source maps — YELLOW

**Look for:** `productionBrowserSourceMaps: true` (Next.js), `build.sourcemap: true` (Vite),
`devtool: 'source-map'` in production webpack config, `.map` files uploaded publicly.

**Why:** visitors can read the original source code of the front end, including comments
and anything sensitive left in it.

**Fix:** turn off public source maps, or upload them only to the error tracker
(Sentry etc.), or use the platform's protected source maps.

## PLT-08 Preview deployments open to the public or using real data — [owner check] (RED if confirmed)

**Ask:** "Are your preview links (the ones made for every change) protected with a login or
password? Do previews use a separate test database, or the real one?"

**Why:** every branch or pull request gets its own public URL. If previews connect to the
production database and aren't protected, anyone with the link can see or change real data
— and may sign up with test features that are not finished.

**Fix:** Vercel: Deployment Protection with Standard Protection (protects everything except
the production domains; available on all plans). Netlify: password/team protection for
deploy previews. Render and Railway: preview/PR environments get their own URLs too — check
which database they use. All platforms: give the Preview environment its own database and keys.

**Evidence to look for in code (raises confidence, still ask):** docs or env examples that
use one `DATABASE_URL` for all environments; seed or migration scripts run on deploy.

## PLT-09 No spending limit on the platform — [owner check] (YELLOW if confirmed)

**Ask:** "Have you set a spending limit or usage alert in your hosting dashboard?"

**Why:** serverless bills grow with traffic. A bot, a loop or a viral moment can turn a
free project into a large invoice before anyone looks.

**Fix:** turn on the platform's spend management / usage alerts and a hard cap where offered;
also cap paid APIs at their provider (see COST-02).
