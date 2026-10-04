# Fair Drop

Fair Drop demonstrates fair allocation when demand greatly exceeds capacity. The production path uses PostgreSQL as the source of truth, Redis for rate limits and draw jobs, a separate worker for the draw and claim-expiry queue, verified email accounts, idempotent joins and claims, a frozen participant snapshot, and a publicly verifiable deterministic ranking.

## Run the deployment locally

Requirements: Docker Desktop with Compose, and Node.js 22+ with npm for local checks.

1. Copy `.env.example` to `.env` and replace every `replace-with-*` value with a fresh secret. `DRAW_ENCRYPTION_KEY` must be base64 for exactly 32 random bytes. Set a private administrator email and a unique password of at least 12 characters. Keep `.env` out of source control.
2. Start all services:

   ```sh
   docker compose up --build -d
   ```

3. Open the app at `http://localhost:3000`, the administrator sign-in at `/auth`, and Mailpit at `http://localhost:8025` to inspect local verification email.
4. Sign in with the administrator credentials from `.env`. Admin pages are under `/admin`.
5. Stop services with `docker compose down`. Persistent Postgres and Redis data remain in Compose volumes. To delete that local data and start over, use `docker compose down -v`.

Compose runs PostgreSQL, Redis, Mailpit, a one-shot schema migration and catalog/admin seed job, the Next.js server, and a BullMQ worker. The health endpoint is `/api/health`. The seeded catalog is scheduled and initially empty; create an event in Admin → Events, open entries, then freeze and draw. For account registration, follow the verification link delivered to Mailpit.

## Local development and checks

```sh
npm install
npm run dev
```

The no-database mode uses the repository's deterministic demo data for UI development. It is not a deployable backend. For deployment behavior use Compose so `DATABASE_URL` and `REDIS_URL` are set.

```sh
npm run lint
npm test
npm run check:data
npm run build
```

## Adversarial traffic runs

The k6 workload is `scripts/load/fairdrop.js`. Install k6 locally, then pass a base URL, scenario, event ID, and verified session cookies when a scenario needs authenticated entries. Supported scenarios include `normal-crowd`, `single-user-spam`, `bot-flood`, `duplicate-join`, `retry-storm`, `claim-race`, and `health`.

```sh
FAIRDROP_BASE_URL=http://localhost:3000 \
FAIRDROP_SCENARIO=health \
FAIRDROP_VUS=20 \
npm run load:k6
```

Join scenarios require `FAIRDROP_EVENT_ID` and comma-separated `FAIRDROP_SESSION_COOKIES`; claim races additionally require selected users' sessions. Results are reported by k6 from live requests. The app does not present generated benchmark results as live measurements.

## Production configuration

Use managed PostgreSQL and Redis (or deploy the Compose services), a real authenticated SMTP provider, HTTPS, durable backups, and a trusted reverse proxy. Set `APP_URL` to the public HTTPS origin. Set `TRUST_PROXY=true` only when the ingress overwrites `X-Forwarded-For`; Next.js route handlers do not expose the socket peer address, so without a trusted forwarded address the signed-in challenge, join, and claim limits fall back to the account ID rather than sharing one global unknown-IP bucket. Keep `SESSION_SECRET` and `DRAW_ENCRYPTION_KEY` private and persistent: losing the draw key prevents revealing/verifying seeds for unfinished draws. Run one worker or scale workers horizontally through BullMQ. Migrations are versioned under `db/migrations` and are applied by the Compose migration service.

The Docker image runs as a non-root user and uses Next standalone output. Place TLS termination and request-size/network protections at the hosting ingress. Monitor `/api/health`, application logs, PostgreSQL, Redis, and the worker process.
