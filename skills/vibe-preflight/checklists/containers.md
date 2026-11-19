# Containers on a server checklist (Docker Compose, Podman, Quadlet)

For apps that run as containers on a VPS or server. Check ids stay `DC-…` for every engine
so findings keep the same key across runs.

## First: which engine and which files

| What you find | Engine | Files to check |
| --- | --- | --- |
| `compose.yaml`, `docker-compose*.yml`, docs say `docker compose` | Docker | every Compose file, including `compose.override.yaml` and `*.prod.yml` |
| Compose files, docs say `podman compose` / `podman-compose` | Podman | same Compose files |
| `*.container`, `*.pod`, `*.network`, `*.volume`, `*.kube` files (often in `quadlet/`, `deploy/`, `systemd/`) | Podman Quadlet | those unit files; they are installed to `~/.config/containers/systemd/` (rootless) or `/etc/containers/systemd/` (rootful) |

Also decide **rootless or rootful** for Podman: rootless if the docs install units under a
user's home or use `systemctl --user`; rootful if they use `/etc/containers/systemd/` or
`sudo`. If unclear, say so in the coverage note and treat it as rootful (the riskier case).

Run `docker compose config --no-interpolate` / `podman compose config --no-interpolate`
(read-only) if available — it shows the merged result. Always pass `--no-interpolate`:
without it the output contains the resolved values of `.env` / `env_file` secrets. If the
flag is unsupported, read the YAML files directly instead.

**Quadlet equivalents** of the Compose keys used below:

| Compose | Quadlet (`[Container]` unless noted) |
| --- | --- |
| `ports:` | `PublishPort=` |
| `network_mode: host` | `Network=host` |
| `volumes:` | `Volume=` (named volumes via a `.volume` unit) |
| `environment:` / `env_file:` | `Environment=` / `EnvironmentFile=` |
| `secrets:` | `Secret=` |
| `image:` | `Image=` (also `AutoUpdate=`) |
| `healthcheck:` | `HealthCmd=`, `HealthInterval=`, `HealthOnFailure=` |
| `restart:` | `Restart=` in `[Service]`, plus `[Install] WantedBy=` |
| `privileged:` / `cap_add:` | `PodmanArgs=--privileged` / `AddCapability=` |
| `user:` | `User=` (without it, the image's user — usually root) |
| `logging:` | `LogDriver=` (default `journald`) |

**Explain this once in the report whenever DC-01 or DC-03 is found — pick the line for the engine:**
- **Docker, and rootful Podman:** published ports are wired up by the container engine's own
  firewall rules. Docker's documentation says this traffic is routed before `ufw` rules
  apply, effectively ignoring the firewall. "I blocked it in ufw" does not protect the port.
  Treat rootful Podman the same unless the owner has tested it from outside.
- **Rootless Podman:** published ports are forwarded by a normal user process, so the host
  firewall does apply. The port is still open wherever the firewall isn't configured —
  including most fresh cloud servers — so the finding stands.

## DC-01 Database or cache port open to the network — RED

**Look for:** published ports (`ports:` / `PublishPort=`) on services whose image is a
database, cache or broker — `postgres`, `mysql`, `mariadb`, `mongo`, `redis`, `valkey`,
`memcached`, `elasticsearch`, `opensearch`, `rabbitmq`, `kafka`, `nats`, `minio`,
`clickhouse`, `couchdb`, `neo4j`, `influxdb`, `cassandra`. A mapping without an IP
(`"5432:5432"`, `PublishPort=5432:5432`) binds to all interfaces.

**Why:** bots scan for these ports all day; an exposed database is usually found within
hours and its data copied, wiped or held for ransom.

**Fix:** remove the published port — other containers reach the database by service or
container name on the shared network. If the developer needs it from the server itself,
bind to localhost: `"127.0.0.1:5432:5432"` / `PublishPort=127.0.0.1:5432:5432`. Keep
dev-only ports in `compose.override.yaml`.

## DC-02 Host networking that exposes services — RED / YELLOW / INFO

Host networking (`network_mode: host`, `Network=host`) is not wrong in itself; what matters
is what it makes reachable. Decide the level by outcome:

- **RED** — used in a file that is deployed to a server, and at least one service in that
  mode listens on all interfaces. Official database and cache images listen on all
  interfaces by default, so a database in host mode on a server is exposed.
- **YELLOW** — used on a server, but every service in host mode is verifiably bound to
  `127.0.0.1` (cite the config), or only the reverse proxy uses it.
- **INFO** — used only in a development file (the item already accounts for this; do not
  also apply `L-DEVONLY`).

**Legitimate reasons and alternatives — mention the one that fits:**
- *Local HTTPS with a self-signed certificate* does not need host networking: a reverse
  proxy on a normal network can serve it (Caddy with `tls internal`, or nginx with an mkcert
  certificate) and publish `127.0.0.1:443:443`.
- *Reaching a service running on the host itself:* Docker —
  `extra_hosts: ["host.docker.internal:host-gateway"]`; Podman provides
  `host.containers.internal` automatically.
- *Many dynamic ports, multicast or discovery (WebRTC, mDNS, some IoT):* host networking may
  be the right choice — then bind each service to the interface it needs and firewall the rest.

## DC-03 App ports published next to the reverse proxy — YELLOW

**Look for:** a reverse proxy (`nginx`, `caddy`, `traefik`) publishing 80/443 while the app
service also publishes its own port on all interfaces (`"3000:3000"`, `PublishPort=8000:8000`).

**Why:** anyone can skip the proxy — and its HTTPS, headers and rate limits — by calling
`http://server-ip:3000`.

**Fix:** only the proxy publishes ports; app services use `expose:` (or nothing), or bind
to `127.0.0.1` when the proxy runs on the host.

## DC-04 Admin panels open to the network — RED

**Look for:** published ports on `pgadmin`, `adminer`, `phpmyadmin`, `mongo-express`,
`redis-commander`, `redisinsight`, `portainer`, `cockpit`, RabbitMQ management (`15672`),
MinIO console (`9001`), Traefik with `--api.insecure=true`, Grafana/Kibana with default
credentials.

**Fix:** remove them from production, or bind to `127.0.0.1` and reach them through an SSH
tunnel or VPN.

## DC-05 Container-engine socket mounted into a container — RED / YELLOW

**Look for:** in volumes: `/var/run/docker.sock`, `/run/podman/podman.sock` (rootful),
`$XDG_RUNTIME_DIR/podman/podman.sock` or `/run/user/<uid>/podman/podman.sock` (rootless).

**Levels:**
- RED — Docker socket or rootful Podman socket: the container can take over the whole server.
- YELLOW — rootless Podman socket: the container can control all of that user's containers
  and files, but not the whole server.

**Fix:** remove it. If a tool truly needs it (Traefik, Watchtower), put a socket proxy in
between that only allows the calls the tool needs. Mounting the socket read-only (`:ro`)
does **not** reduce the risk — it does not limit which API calls can be made through it.

## DC-06 Container given host-level powers — RED

**Look for:** `privileged: true` / `PodmanArgs=--privileged`, `cap_add: [ALL]` or
`SYS_ADMIN` / `AddCapability=SYS_ADMIN`, `pid: host`, `ipc: host`,
`security_opt: [seccomp:unconfined]` / `SeccompProfile=unconfined`,
`SecurityLabelDisable=true`, `user: root` set explicitly for the app.

## DC-07 Passwords in the deploy files or left at defaults — RED

_Level: `L-INTERNAL` (SKILL.md step 3) applies only to a weak or default password on a service that is not published. It does not apply to a secret that sits in a committed file: anyone who can read the repo has it._

**Look for:** literal secrets in `environment:` / `Environment=` (`POSTGRES_PASSWORD: postgres`,
`MYSQL_ROOT_PASSWORD: root`, `password`, `changeme`, `secret`, `admin`, `minioadmin`); an
`env_file:` / `EnvironmentFile=` whose file is committed to git (see SEC-02).

**Fix:** values from an untracked env file next to the deploy files (`${POSTGRES_PASSWORD}`),
Docker/Podman secrets (`Secret=` in Quadlet); strong generated passwords; never the image's
example password.

## DC-08 Redis without a password — YELLOW (RED if its port is published)

**Look for:** a Redis/Valkey service without `--requirepass`, `REDIS_PASSWORD` or ACL config.

## DC-09 Database data not on a volume — RED

**Look for:** database services with no named volume or bind mount for their data
directory, or only an anonymous one. Data directories: PostgreSQL ≤17
`/var/lib/postgresql/data`, **PostgreSQL 18+ `/var/lib/postgresql`** (the official image
changed it — a volume on the old path breaks startup); MySQL/MariaDB `/var/lib/mysql`;
MongoDB `/data/db`; Redis with persistence `/data`.

**Why:** after `compose down` and `up` again (or `down -v`), the database starts empty —
the old anonymous volume is left behind, not reattached. With Quadlet, anonymous volumes
are removed whenever the container stops.

**Fix:** a named volume on the right path for the image version
(`pgdata:/var/lib/postgresql/data` for ≤17, `pgdata:/var/lib/postgresql` for 18+, plus a
top-level `volumes:` entry; in Quadlet a `.volume` unit), and a backup.

## DC-10 Image versions not pinned — YELLOW

**Look for:** `image:` / `Image=` without a tag, or `:latest`, especially for databases;
Quadlet `AutoUpdate=registry` on a `:latest` or major-less tag.

**Why:** a restart or auto-update can pull a new major version. PostgreSQL, for example,
cannot read a data directory created by a different major version, so the database won't start.

**Fix:** pin at least the major version (`postgres:17`, `redis:8`), better the minor.

## DC-11 Won't come back after a reboot or crash — YELLOW

**Look for:**
- Compose: services without `restart:` (use `restart: unless-stopped`).
- Quadlet: no `Restart=` in `[Service]`, or no `[Install] WantedBy=default.target`
  (rootless) / `multi-user.target` (rootful).
- Rootless Podman: services stop when the user logs out and don't start at boot unless
  lingering is enabled for that user (`loginctl enable-linger <user>`). If the docs don't
  mention it, record it as an owner check.

**Why:** after a server reboot or a crash, the app stays down until someone notices.

## DC-12 App starts before the database is ready — YELLOW

**Look for:**
- Compose: `depends_on:` as a plain list, without healthchecks.
- Quadlet: no `HealthCmd=` on the database, or the app unit has no ordering
  (`After=`/`Requires=` on the database unit) and no retry on connect.

**Fix (Compose):** a `healthcheck:` on the database (`pg_isready -U $$POSTGRES_USER`,
`mysqladmin ping`, `redis-cli ping`) and `depends_on: { db: { condition: service_healthy } }`.
**Fix (Quadlet):** `HealthCmd=` plus `Notify=healthy` on the database, and
`After=`/`Requires=` on the app unit.

## DC-13 Logs grow forever — YELLOW

**Look for:**
- Docker: no `logging:` options — the default `json-file` driver does not rotate.
- Podman with `journald` (the Quadlet default): **pass** — journald rotates by its own
  settings.
- Podman with `k8s-file` or `json-file` and no size limit (`log_size_max` / `--log-opt max-size`).

**Fix (Docker):** per service, or via an `x-logging` anchor:
`logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }`.

## DC-14 Development setup used in production — YELLOW

**Look for:** source code bind-mounted into the app (`./:/app`, `Volume=.:/app`);
`command:` / `Exec=` running a dev server (`npm run dev`, `--reload`); `NODE_ENV=development`.

**Fix:** a production setup that runs the built image (see `dockerfile.md`); keep the dev
setup in a separate file.

## DC-15 No HTTPS on the deployed app — RED if the app has logins or session cookies, YELLOW otherwise

**Only for the setup that real users reach.** Local development without HTTPS is normal:
mark this `n/a` for development-only files (do not report it, not even as INFO).

**Look for, in the files deployed to a server:** a way HTTPS is provided —
- a reverse proxy with TLS in the deploy files (Caddy, Traefik with ACME, nginx with certbot);
- or TLS handled outside the repo and **documented** (nginx/Caddy on the host, Cloudflare,
  a cloud load balancer) — then this is a `pass`, citing the doc;
- or the app bound to `127.0.0.1` behind a proxy that isn't described anywhere — record
  `ask owner`: "Is your site opened with https:// and a padlock in the browser?"

It is a finding only when the deploy files show the app served directly to the network on
plain HTTP (e.g. `"80:3000"` or `"3000:3000"` with no proxy and no TLS mentioned).

**Why:** logins and cookies travel in clear text; browsers mark the site "Not secure".

## DC-16 No resource limits — INFO

**Look for:** no `mem_limit` / `cpus` / `deploy.resources.limits`, or Quadlet `Memory=` /
`PidsLimit=`. One runaway service can starve the database on a small VPS.

## DC-17 Obsolete `version:` key — INFO

The top-level `version:` key is ignored by current Docker Compose. Harmless; remove it to
avoid the warning. Do not report it as a risk.
