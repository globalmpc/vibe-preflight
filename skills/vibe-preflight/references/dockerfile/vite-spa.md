# Reference: single-page app (Vite, React, Vue, Svelte — static build)

Use this when the app builds to static files and has no server code of its own (the API is
a separate service). Node is needed only to build; the final image is a small web server.

If the project uses SSR (Nuxt, SvelteKit with a Node adapter, Remix, Astro SSR), this
reference does **not** apply — treat it like a Node server (`node-api.md` principles).

## Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_* variables are baked in at build time — pass them as build args:
# ARG VITE_API_URL
# ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Unprivileged nginx: runs as non-root and listens on 8080. Pin to the current stable tag.
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

## nginx.conf (create next to the Dockerfile)

```nginx
server {
    listen 8080;
    root /usr/share/nginx/html;
    index index.html;

    # Client-side routing: unknown paths fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Hashed build assets can be cached for a long time
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

## Adapting

- **Build output folder:** Vite uses `dist/`; Create React App uses `build/`; check
  `vite.config` (`build.outDir`) or the framework's config.
- **Environment variables:** everything prefixed `VITE_` (or `REACT_APP_`) ends up in the
  browser bundle and is fixed at build time. Never put secrets there (SEC-03). Changing the
  API URL per environment means rebuilding, or loading a small `config.json` at startup.
- **pnpm / yarn:** same adjustments as in `nextjs.md`.
- **Behind a reverse proxy with TLS:** this container serves plain HTTP on 8080; the proxy
  in Compose terminates HTTPS (DC-15).
