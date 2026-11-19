# Reference: Node API (Express, Fastify, NestJS, Hono)

Build and runtime stages use the **same base image**, so native modules compiled in the
build stage (bcrypt, sharp, better-sqlite3, Prisma engines) match the runtime.

## Dockerfile (TypeScript, compiled to `dist/`)

```dockerfile
# syntax=docker/dockerfile:1
# Pin to the Node major the project uses (engines / .nvmrc).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && npm prune --omit=dev

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Adapting

- **Entry file:** NestJS builds to `dist/main.js`; other projects often use `dist/index.js`
  or `dist/server.js`. Read the `start` / `start:prod` script and `tsconfig` `outDir`.
- **Plain JavaScript (no build step):** drop the build; in the build stage use
  `RUN npm ci --omit=dev`, then copy `node_modules` and the source folder; `CMD` points to
  the real entry file.
- **Listen address:** the server must listen on `0.0.0.0` (or omit the host) and read the
  port from `PORT` (DF-09).
- **Prisma:** add `RUN npx prisma generate` before `npm run build`. Keep `prisma` (the CLI)
  available if migrations run from this image: either keep it in `dependencies` or run
  migrations from the build stage image as a separate release step. Do not put
  `migrate deploy` inside `CMD` for apps with more than one replica.
- **Files the app writes** (uploads, SQLite): mount a volume and make sure the `node` user
  owns that path.
- **pnpm / yarn:** same adjustments as in `nextjs.md`; `pnpm prune --prod` replaces
  `npm prune --omit=dev`.
- **Health check:** without `curl` in slim images, use
  `node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
