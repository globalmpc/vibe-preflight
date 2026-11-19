# Reference: Python (FastAPI, Django, Flask)

Dependencies are installed into a virtual environment in the build stage; the final stage
copies only that environment and the source. Compilers and headers stay in the build stage.

## Dockerfile with uv (`pyproject.toml` + `uv.lock`)

```dockerfile
# syntax=docker/dockerfile:1
# Pin to the Python version the project uses (.python-version / requires-python).
FROM python:3.13-slim AS build
# Pin uv to a specific release instead of <version>.
COPY --from=ghcr.io/astral-sh/uv:<version> /uv /uvx /bin/
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY . .
RUN uv sync --frozen --no-dev

FROM python:3.13-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home --uid 10001 app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Dockerfile with pip (`requirements.txt`)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.13-slim AS build
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.13-slim AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
RUN useradd --create-home --uid 10001 app
COPY --from=build /opt/venv /opt/venv
COPY --chown=app:app . .
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Start command by framework

- **FastAPI:** `uvicorn <module>:app --host 0.0.0.0 --port 8000` (never `--reload`). For
  several workers: `--workers 2`, or gunicorn with `-k uvicorn.workers.UvicornWorker`.
  Find `<module>` from where `FastAPI()` is created.
- **Django:** `gunicorn <project>.wsgi:application --bind 0.0.0.0:8000 --workers 3`
  (`gunicorn` must be in the dependencies). Run `python manage.py collectstatic --noinput`
  in the build stage — it may need a dummy `SECRET_KEY` build-time env, never the real one.
  With the uv example this works as is. With the **pip** example the build stage has only
  `requirements.txt`, so add `COPY . .` before `collectstatic`, then copy the result into the
  runner (`COPY --from=build --chown=app:app /app/<STATIC_ROOT> ./<STATIC_ROOT>`); the runner
  otherwise gets only `/opt/venv`. Or skip this and serve static files with WhiteNoise.
  Run `python manage.py migrate` as a separate release step. `DEBUG` must be off (RDY-03).
- **Flask:** `gunicorn "<module>:create_app()" --bind 0.0.0.0:8000` or `<module>:app`;
  never `flask run`.

## Adapting

- **Packages that compile C code** (e.g. `psycopg2` from source, `mysqlclient`): install
  `build-essential` and the `-dev` headers (`libpq-dev`) in the **build** stage only, and the
  runtime library (`libpq5`) in the runner stage. Prefer binary wheels (`psycopg[binary]`)
  when the project allows.
- **Poetry:** export to `requirements.txt` in the build stage, or install with
  `poetry install --only main --no-root` into an in-project venv and copy it like the uv example.
- **Unpinned `requirements.txt`:** flag DF-06 / DEP-05 — the image changes on every build.
- **Health check:** slim images have no `curl`; use
  `python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health').status==200 else 1)"`.
