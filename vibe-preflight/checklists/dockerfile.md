# Dockerfile checklist (also `Containerfile`)

Everything below applies equally to a `Containerfile` built with Podman or Buildah.

The most common Dockerfile from an AI agent is `COPY . .` followed by `npm start`. It
works, but ships secrets, dev tools and laptop-built modules into a large image that runs
as root. Check the items below, then — if the user wants — propose a multi-stage
Dockerfile (last section).

## DF-01 No `.dockerignore`, or it misses secrets — RED / YELLOW

**Look for:** no `.dockerignore` (or `.containerignore`) next to the Dockerfile, or one that does not exclude
`.env*` at any depth (`**/.env`, `**/.env.*`, except `.env.example`), `.git`,
`node_modules`, build output (`dist`, `.next`, `build`), `.venv`/`venv`, `__pycache__`,
`*.pem`/`*.key`, `.vibe-preflight`.

**Level — decide by where the secret ends up:**
- RED — a secret file can reach the **final** image: single-stage build with `COPY . .`,
  or a `COPY --from` that copies a folder containing it.
- YELLOW — it reaches only an intermediate build stage (it is still sent to the Docker
  daemon and stored in the build cache, but not shipped). Say which `COPY` lines you
  checked to conclude this.
- INFO — nothing secret is missed; only clutter (`.git`, docs, leftovers) is.

**Why:** `COPY . .` puts the `.env` file and git history inside the image; anyone who can
pull the image can read them. Local `node_modules` built on Mac/Windows can also break on Linux.

## DF-02 Secrets baked into the image — RED

**Look for:** `ENV` or `ARG` with secret values or names (`API_KEY`, `SECRET`, `TOKEN`,
`PASSWORD`, `DATABASE_URL` with credentials); `COPY .env`.

**Fix:** pass secrets at runtime (Compose `environment:`/`env_file:`); for secrets needed
during build, use BuildKit: `RUN --mount=type=secret,id=npmrc …`.

## DF-03 Development command in `CMD` — RED

**Look for:** `npm run dev`, `next dev`, `vite`, `nodemon`, `ts-node`, `uvicorn … --reload`,
`flask run`, `python manage.py runserver`, `php artisan serve`.

**Fix:** the production command for the stack (see references).

## DF-04 Single stage: build tools and dev dependencies shipped — YELLOW

**Look for:** a build step (`npm run build`, `tsc`, `vite build`, compiling wheels,
`go build`) in the same stage as the final `CMD`; `devDependencies` present at runtime.

**Why:** an image 5–10× bigger than needed — slower deploys, more disk, more packages
with possible vulnerabilities.

**Fix:** multi-stage build (see "Proposing a Dockerfile").

## DF-05 `COPY . .` before installing dependencies — YELLOW

**Look for:** the full source copied before the dependency install step.

**Why:** every code change re-installs all dependencies; builds take minutes instead of seconds.

**Fix:** copy only the manifest and lockfile, install, then copy the source.

## DF-06 Non-reproducible install — YELLOW

**Look for:** `npm install` (use `npm ci`), `yarn install` without `--frozen-lockfile`
(Yarn 1) or `--immutable` (Yarn Berry), `pnpm install` without `--frozen-lockfile`,
`pip install` of unpinned packages, `uv sync` without `--frozen` / `--locked`,
`composer install` without `--no-dev` in production.

## DF-07 Runs as root — YELLOW

**Look for:** no `USER` instruction in the final stage.

**Fix:** official Node images ship a `node` user; for Python/others create one
(`useradd --create-home --uid 10001 app`) and `USER app`. Make sure files the app writes
to are owned by that user (`COPY --chown=…`).

## DF-08 Unpinned or heavy base image — YELLOW

**Look for:** `FROM node`, `FROM python:latest`, `FROM ubuntu` without a version; full
images (`node:24`, `python:3.13`) where `-slim` would do.

**Note:** prefer `-slim` (Debian) as the default. Alpine (musl) sometimes breaks Python
wheels and Node native modules; use it only when the project already does.

## DF-09 App listens only on localhost inside the container — YELLOW

**Look for:** the server bound to `127.0.0.1` / `localhost` (`app.listen(3000, 'localhost')`,
`uvicorn --host 127.0.0.1`, Next.js standalone without `HOSTNAME=0.0.0.0`).

**Why:** it works on the laptop but is unreachable from outside the container.

## DF-10 Shell-form `CMD` with a package-manager wrapper — YELLOW

**Look for:** `CMD npm start`, `CMD yarn start`, `CMD ["npm", "start"]`.

**Why:** the wrapper may not pass the stop signal to the app, so `docker stop` waits and
then kills it — in-flight requests and writes are cut off.

**Fix:** exec form running the runtime directly: `CMD ["node", "dist/main.js"]`.

## DF-11 No health check — INFO

**Look for:** no `HEALTHCHECK` and no `healthcheck:` in Compose. See RDY-08 and DC-12.

## DF-12 Leftover package caches — INFO

**Look for:** `apt-get install` without `--no-install-recommends` and without
`rm -rf /var/lib/apt/lists/*`; `pip install` without `--no-cache-dir`; `apt-get upgrade`
in the Dockerfile (pin the base image instead).

## Proposing a Dockerfile

Only after the user approves. Steps:

1. **Identify the stack** from the profile (step 1 of SKILL.md) and open the matching reference:

   | Stack | Reference |
   | --- | --- |
   | Next.js | `references/dockerfile/nextjs.md` |
   | Vite / React / Vue / Svelte single-page app (static build) | `references/dockerfile/vite-spa.md` |
   | Node API: Express, Fastify, NestJS, Hono | `references/dockerfile/node-api.md` |
   | Python: FastAPI, Django, Flask | `references/dockerfile/python.md` |

   Other stacks: apply the principles below without a reference, and say so in the report.
   (Go: build a static binary, run it from `gcr.io/distroless/static` or `scratch`.
   PHP/Laravel: `composer install --no-dev` in a build stage, PHP-FPM behind nginx.)

2. **Adapt, don't paste.** Match the project's package manager, runtime version (from
   `engines`, `.nvmrc`, `.python-version`), build output folder, port and start command.

3. **List every change outside the Dockerfile** explicitly in the report — e.g.
   `output: 'standalone'` in `next.config`, a `.dockerignore`, a health route, build args
   for public env vars.

4. **Verify.** If Docker is available and the user agrees: `docker build -t vibe-check .`,
   fix until it builds, then optionally run it and request the health route. If Docker is
   not available: mark the proposal "not verified — run `docker build .` to confirm".
   Never present an unbuilt Dockerfile as tested.

**Principles every proposal follows:** `.dockerignore`; manifest + lockfile copied before
source; deterministic install; build tools only in the build stage; pinned `-slim` base;
final stage runs as a non-root user; production start command in exec form; listens on
`0.0.0.0`; no secrets in `ENV`/`ARG`.
