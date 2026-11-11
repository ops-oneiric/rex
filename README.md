# Rex

A private, single-admin web app for managing associates, assigning incoming clients, tracking 1:1s (Cadence) and escalations, with Claude recommending the best-fit associates.

The full plan, including decisions and phases, is in [docs/DEVELOPMENT_PLAN.md](docs/DEVELOPMENT_PLAN.md).

**Status:** All phases (0 to 8) are complete. Rex is ready to deploy.

- [Deployment and operations](docs/DEPLOYMENT.md): server setup, HTTPS, updates, backups and restore.
- [User guide](docs/USER_GUIDE.md): setting Rex up and using it day to day.
- [Security review](docs/SECURITY.md): controls, changes made before go-live, accepted risks.


- **Phase 0, foundation:** login, layout, design system, encrypted Claude API key in Settings, Docker deployment and CI.
- **Phase 1, associates:** roster with search and filters, PM/Payroll seats, capability levels and notes, PTO, the directly-managed flag, plus the capability list and your time zone in Settings.
- **Phase 2, clients:** prospects, implementations and service clients with stage history, table and board views, business days with holidays, fast-start flags and workload weights, plus the weight formula, complexity scale and holiday list in Settings.
- **Phase 3, assignments:** ranked candidates per seat from the rules engine (PTO knock-outs, first input collisions, capacity, capability fit, time zone), holds on prospects, load bars, the first input timeline, and editable assignment rules.
- **Phase 4, AI recommendations:** Claude proposes complete teams from the rules engine's facts, with names and codes replaced before anything is sent; accept, swap or decline, with history, usage and live evaluation scenarios (`npm run eval`).
- **Phase 5, Cadence:** two-input 1:1 notes (date and notes) analyzed by Claude in the background: summary, action items, strengths, growth areas, skills and morale; an action-item checklist with follow-up suggestions; 90-day trend reports with talking points; and an overdue-1:1 view.
- **Phase 6, Escalations:** two-input escalation log (date and details) with names, codes and contact details coded before Claude sees them, plus a preview. Claude proposes the client, people, category, severity, fault and root cause, and you confirm. Includes action items, Open/Resolved status, and trends over confirmed escalations by month, fault, category, severity, client and associates at fault, with Claude's pattern reading.
- **Phase 7, Dashboard & Insights:** a dashboard with a "Needs attention" strip, the assignment queue, a 60-day first input timeline, capacity, upcoming PTO with conflicts on clients already assigned, due 1:1s, your action items and open escalations. Also an Insights page (capacity over time, first input density, fast starts and runway, implementation durations, escalations by implementation type and start, Claude acceptance and spend) and a Ctrl+K / Cmd+K command palette.
- **Phase 8, go-live:** security review and hardening (nonce-based Content Security Policy, forged IP headers ignored, Settings > Security with sessions and sign-in activity), nightly encrypted backups with retention, a restore script, backup download and CSV export, a deployment runbook and a user guide.

## Stack

Next.js 16 (App Router, TypeScript), Tailwind CSS 4, SQLite with Drizzle ORM, Anthropic TypeScript SDK, Lucide icons, Vitest and Playwright.

## Deploy on your server

The full runbook is [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short, on a Linux server with Docker, a domain pointed at it, and ports 80 and 443 open:

```bash
git clone https://github.com/ops-oneiric/rex.git && cd rex && cp .env.example .env
```

Set `REX_ENCRYPTION_KEY` (from `openssl rand -base64 32`, and keep a copy in your password manager) and `REX_DOMAIN` in `.env`, then:

```bash
docker compose up -d --build
```

```bash
docker compose exec rex node scripts/set-admin.mjs
```

Open `https://<your domain>`, sign in, and add your Claude API key in **Settings > Claude**.

Update later with:

```bash
git pull && docker compose up -d --build
```

Backups run every night, are encrypted with `REX_ENCRYPTION_KEY`, and appear in **Settings > Backups and data**. Restore with `scripts/restore-backup.mjs`; see the runbook.

## Security notes

See [docs/SECURITY.md](docs/SECURITY.md). In brief:

- There is no two-factor authentication, by choice. The login is protected by a 12-character minimum password, account lockout after 5 failed attempts (15 minutes, doubling up to 24 hours), and a per-IP limit of 10 failed attempts per 15 minutes. Every attempt is recorded and visible in **Settings > Security**.
- Sessions are random tokens stored only as hashes, ending after 12 hours idle or 7 days in total.
- Pages carry a nonce-based Content Security Policy. Only Caddy (HTTPS) is reachable from the internet.
- The Claude API key and every backup are encrypted with `REX_ENCRYPTION_KEY`, which lives only in the server environment.

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

Live recommendation scenarios (calls the Claude API; a few cents per scenario):

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run eval
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
    api/            health check, backup download, CSV export
  components/       brand (logo), layout (sidebar, headers), ui (buttons, inputs, cards)
  lib/
    auth/           password hashing, sessions, lockout policy, access guard
    ai/             Claude client and model list
    crypto/         secret encryption
    backups/        encrypted backup format, scheduler, retention
    insights/       dashboard and Insights calculations
    db/             Drizzle schema, connection, migrations
  proxy.ts          per-request CSP nonce; redirects signed-out visitors to /login
drizzle/            SQL migrations
scripts/
  set-admin.mjs       create or reset the admin account
  restore-backup.mjs  check or restore an encrypted backup
docs/                 plan, deployment runbook, user guide, security review
tests/              unit (Vitest) and e2e (Playwright)
```
