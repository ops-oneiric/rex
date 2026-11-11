# Rex

A private, single-admin web app for managing associates, assigning incoming clients, tracking 1:1s (Cadence) and escalations, with Claude recommending the best-fit associates.

The full plan, including decisions and phases, is in [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

**Status:** Phases 0 to 3 are complete.

- **Phase 0, foundation:** login, layout, design system, encrypted Claude API key in Settings, Docker deployment and CI.
- **Phase 1, associates:** roster with search and filters, PM/Payroll seats, capability levels and notes, PTO, the directly-managed flag, plus the capability list and your time zone in Settings.
- **Phase 2, clients:** prospects, implementations and service clients with stage history, table and board views, business days with holidays, fast-start flags and workload weights, plus the weight formula, complexity scale and holiday list in Settings.
- **Phase 3, assignments:** ranked candidates per seat from the rules engine (PTO knock-outs, first input collisions, capacity, capability fit, time zone), holds on prospects, load bars, the first input timeline, and editable assignment rules.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, SQLite with Drizzle ORM, Anthropic TypeScript SDK, Lucide icons, Vitest and Playwright.

## Deploy on your server

Requirements: a Linux server with Docker and the Compose plugin, ports 80 and 443 open, and a domain (or subdomain) whose DNS A record points at the server. Caddy uses the domain to get an HTTPS certificate automatically.

1. Get the code onto the server and create the environment file:

   ```bash
   git clone https://github.com/ops-oneiric/rex.git && cd rex
   ```

   ```bash
   cp .env.example .env
   ```

2. Edit `.env`:
   - `REX_ENCRYPTION_KEY`: generate with `openssl rand -base64 32`. Keep a copy somewhere safe; if it is lost, the saved Claude API key must be re-entered.
   - `REX_DOMAIN`: your domain, for example `rex.example.com`.

3. Start Rex:

   ```bash
   docker compose up -d --build
   ```

4. Create the admin account (you'll be asked for a username and password, at least 12 characters):

   ```bash
   docker compose exec rex node scripts/set-admin.mjs
   ```

5. Open `https://<your domain>`, sign in, go to **Settings** and paste your Claude API key. Use **Test connection** to confirm it works.

### Day-to-day

Update to the latest version:

```bash
git pull && docker compose up -d --build
```

Reset a forgotten password (this also clears a lockout and signs out every session):

```bash
docker compose exec rex node scripts/set-admin.mjs
```

View logs:

```bash
docker compose logs -f rex
```

The database lives in the `rex-data` Docker volume (`/app/data/rex.db`). Automated nightly backups arrive in the go-live phase. Until then, copy it with:

```bash
docker compose cp rex:/app/data/rex.db ./rex-backup.db
```

## Security notes

- There is no two-factor authentication, by choice. The login is protected by a 12-character minimum password, account lockout after 5 failed attempts (15 minutes, doubling up to 24 hours), and a per-IP limit of 10 attempts per 15 minutes. Every attempt is recorded in the audit log.
- Sessions are random tokens stored only as hashes. They expire after 12 hours idle or 7 days in total.
- The Claude API key is encrypted with AES-256-GCM using `REX_ENCRYPTION_KEY`, which lives only in the server environment. The key is never sent to the browser.
- The app container is not exposed directly. Only Caddy (HTTPS) is reachable from the internet.

## Local development

Requires Node.js 22.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Set `REX_ENCRYPTION_KEY` in `.env.local` (`openssl rand -base64 32`), then create a local admin and start the dev server:

```bash
npm run admin
```

```bash
npm run dev
```

Checks:

```bash
npm run lint && npm run typecheck && npm test
```

End-to-end tests run against a production build with a throwaway database:

```bash
npm run build && npm run test:e2e
```

After changing `src/lib/db/schema.ts`, generate a migration (applied automatically on next start):

```bash
npm run db:generate
```

## Project layout

```
src/
  app/
    (app)/          signed-in pages: dashboard, clients, assign, associates, cadence, escalations, insights, settings
    login/          sign-in page and login/logout actions
    api/health/     health check used by Docker
  components/       brand (logo), layout (sidebar, headers), ui (buttons, inputs, cards)
  lib/
    auth/           password hashing, sessions, lockout policy, access guard
    ai/             Claude client and model list
    crypto/         secret encryption
    db/             Drizzle schema, connection, migrations
  proxy.ts          redirects signed-out visitors to /login
drizzle/            SQL migrations
scripts/set-admin.mjs  create or reset the admin account
tests/              unit (Vitest) and e2e (Playwright)
```
