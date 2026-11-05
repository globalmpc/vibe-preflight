# Reference: Next.js (standalone output)

The final image contains only Next.js's traced server files, not the full `node_modules`.

## Required change outside the Dockerfile

`next.config.(js|mjs|ts)` must contain `output: 'standalone'`:

```js
const nextConfig = {
  output: 'standalone',
  // keep the project's existing options
};
```

List this change explicitly in the report.

## Dockerfile (npm)

```dockerfile
# syntax=docker/dockerfile:1
# Pin to the Node major the project uses (engines / .nvmrc).
FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public env vars are baked in at build time — pass them as build args:
# ARG NEXT_PUBLIC_API_URL
# ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
```

## Adapting

- **pnpm:** copy `pnpm-lock.yaml`; add `RUN npm install -g pnpm@<version from
  packageManager>` to the `base` stage (every stage starts from `base`, so an install in
  `deps` alone would be missing in `build`); in `deps` use `RUN pnpm install --frozen-lockfile`;
  build with `pnpm run build`.
- **yarn (Berry):** copy `yarn.lock` and `.yarnrc.yml` (and `.yarn/releases` if present);
  `RUN yarn install --immutable`.
- **No `public/` folder:** remove that `COPY` line, or the build fails.
- **`NEXT_PUBLIC_*` variables** are inlined into the JavaScript at build time. Setting them
  only at runtime (Compose `environment:`) has no effect — they must be build args. Secrets
  must never use this prefix (SEC-03).
- **Server-only env vars** (database URL, API keys) are read at runtime; pass them through
  Compose, not the Dockerfile.
- **Prisma:** run `npx prisma generate` in the `build` stage before `npm run build`. Run
  migrations as a separate release step (`npx prisma migrate deploy`), not in `CMD`.
- **Health check:** if the project has `/api/health`, add to Compose:
  `test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]`
  (slim images have no `curl`).
