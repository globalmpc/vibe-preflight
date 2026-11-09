# Deploy readiness checklist

Things that make the app fail, leak, or lose data once it runs somewhere other than the
developer's laptop. Target-specific checks are in `containers.md`, `platforms.md` and
`dockerfile.md`.

## RDY-01 Environment variables undocumented — YELLOW

**Look for:** variables read in code (`process.env.X`, `import.meta.env.X`, `os.environ`,
`os.getenv`, `env('X')`, `config('x')`) that are missing from `.env.example`; or no
`.env.example` at all.

**Why:** whoever deploys has to guess, and a missing variable often fails only at runtime.

**Fix:** a complete `.env.example` with placeholder values and one comment per variable.

## RDY-02 Dangerous fallback values — RED

**Look for:** secrets with a default in code: `process.env.JWT_SECRET || 'secret'`,
`os.getenv("SECRET_KEY", "dev")`, Django's generated `SECRET_KEY` left in `settings.py`.

**Why:** if the variable is forgotten in production, the app silently runs with a secret
that is published in the code.

**Fix:** fail at startup when a required secret is missing (validate env with zod,
pydantic-settings, envalid, etc.).

## RDY-03 Development mode in production — RED / YELLOW

**Look for:**
- RED: `DEBUG = True` (Django) or `debug=True` (Flask/FastAPI) without an env switch;
  `APP_DEBUG=true` (Laravel) in production config.
- YELLOW: the start command runs a dev server — `next dev`, `vite`, `nodemon`, `ts-node`,
  `uvicorn --reload`, `flask run`, `manage.py runserver`, `php artisan serve`; `NODE_ENV`
  never set to `production`.

## RDY-04 Build problems hidden — YELLOW

**Look for:** `typescript.ignoreBuildErrors: true`, `eslint.ignoreDuringBuilds: true`,
`// @ts-ignore` on many lines, a build script that is missing or never run.

**Why:** errors that would have stopped the build reach users instead.

## RDY-05 Can't be run from a clean clone — YELLOW

**Look for:** no README section on how to install and run; runtime version not pinned
(`engines`, `.nvmrc`, `.node-version`, `.python-version`, `requires-python`); required
services (database, Redis) not documented or not in Compose; setup steps that only exist
in someone's shell history.

## RDY-06 Database schema not managed by migrations — RED / YELLOW

**Look for:**
- RED: TypeORM `synchronize: true` or Sequelize `sync({ alter: true })` / `sync({ force: true })`
  in production config — these can drop columns and data.
- YELLOW: schema changed with `prisma db push` or `drizzle-kit push` and no committed
  migrations folder; Django models changed without migration files.
- RED: seed scripts that create accounts with real-looking or fixed passwords and run in production.
- YELLOW: migrations that drop columns or tables without a backup step.

**Fix:** generate and commit migrations; run `migrate deploy` (or equivalent) as a release
step; back up before destructive migrations.

## RDY-07 Addresses hard-coded to the developer's machine — YELLOW

**Look for:** `http://localhost`, `127.0.0.1`, fixed ports in frontend API calls, OAuth
callback URLs, CORS lists or email links outside of dev-only config.

## RDY-08 No health check endpoint — INFO

**Look for:** a cheap route such as `/health` or `/api/health` that returns 200 when the app
(and optionally its database) is up. Compose and load balancers use it to restart broken containers.

## RDY-09 No backups for user data — INFO

_Level: `H-SENSITIVE` applies (SKILL.md step 3) when the profile says sensitive data is stored._

**Look for:** any documented backup for the database and uploaded files. If none, say so
plainly: the first disk failure or wrong command loses everything.

With a hosted database (Supabase, Neon, PlanetScale, Railway, Render…) the backup lives in
the provider's settings, which the agent can't see — record it as `ask owner`: "Does your
database plan include automatic backups, and have you tried restoring one?"
