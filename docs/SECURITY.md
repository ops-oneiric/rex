# Security review

Review done in Phase 8, before go-live. It covers how Rex is exposed, what protects it, what was changed in the review, and the risks accepted on purpose.

## What Rex protects

- Client details (company codes, names, key dates) and associate details (names, PTO, capabilities).
- Your 1:1 notes and escalation details, which are sensitive about people.
- The Claude API key, which costs money if misused.

Rex is open to the internet (decision D8) with one admin account and no 2FA (D11). The sign-in page therefore carries most of the protection.

## Controls in place

**Sign-in**
- One admin account, created on the server with a command. There is no public sign-up or setup page.
- The password must be at least 12 characters, is checked against the username and obvious repetition, and is stored as an argon2id hash.
- The account locks after 5 wrong passwords: 15 minutes at first, doubling each time up to 24 hours.
- Each IP address gets 10 failed attempts per 15 minutes; successful sign-ins don't count.
- Every sign-in event is recorded and shown in **Settings > Security**. Five or more failures in a day appear on the dashboard.
- Errors never say whether the username or the password was wrong. When the username is wrong, Rex still runs a password check, so the response takes the same time.

**Sessions**
- A session is a 256-bit random token. The database stores only its SHA-256 hash.
- The cookie is HTTP-only, Secure and SameSite=Lax.
- Sessions end after 12 hours idle or 7 days in total. Changing the password signs out every other browser, and **Settings > Security** can do the same on demand.
- Every page, server action and download checks the session against the database. The proxy's redirect to the sign-in page is only a first filter.

**Browser protections**
- A Content Security Policy with a fresh nonce per request and `'strict-dynamic'`: only scripts Rex served can run. There is no `'unsafe-inline'` or `'unsafe-eval'` for scripts in production.
- `frame-ancestors 'none'` plus `X-Frame-Options: DENY` stop Rex being framed. Rex also sends `nosniff`, `Referrer-Policy: no-referrer`, a locked-down `Permissions-Policy`, and `noindex` on every response and in `robots.txt`.
- HSTS from Caddy, so browsers only ever use HTTPS.
- Server actions only accept requests whose Origin matches the host (Next.js checks this), which blocks cross-site form posts.

**Data**
- The Claude API key is stored encrypted (AES-256-GCM) with `REX_ENCRYPTION_KEY`, which exists only in the server's environment. It's never logged or sent to the browser; Settings shows only its last four characters.
- Before anything is sent to Claude, recommendation requests, escalation reviews and escalation trends have names and company codes replaced with codes. Emails, phone numbers, SSNs, EINs and long numbers are removed. 1:1 notes are sent as written, by your decision (D7), and Rex never names the associate in those requests. Each Claude result screen shows exactly what was sent.
- Backups are encrypted with a key derived from `REX_ENCRYPTION_KEY`, with a random salt per file. A copied backup is useless without the key.
- CSV exports protect against formula injection: cells starting with `=`, `+`, `-` or `@` are written as text.
- Downloads are sent with `Cache-Control: no-store` and only exist for a signed-in session. Backup names are checked against a strict pattern, so file paths can't be smuggled in.

**Server**
- Only Caddy is published; the app container is reachable only inside Docker's network.
- The app runs as an unprivileged user (`node`), and backup files are created readable by that user only.
- The Docker health check uses `/api/health`, which reveals nothing but `ok`.

## Changes made in this review

1. **Content Security Policy:** moved from a static policy that allowed inline scripts to a per-request nonce with `'strict-dynamic'`. Every page now renders per request so it can carry the nonce. A browser test checks the header, checks that the nonce changes on each request, and checks that sign-in still works with no CSP violations.
2. **Client IP:** Rex now uses the address added by its own proxy (the last `X-Forwarded-For` entry), not the first entry, which a visitor could forge to slip past the per-IP limit.
3. **Visibility:** added **Settings > Security**, with signed-in browsers, a "Sign out other browsers" button, and sign-in activity. Repeated failures now show on the dashboard.
4. **Backups:** nightly encrypted backups, a 30-day retention, a restore script with an integrity check, download from Settings, and dashboard warnings when backups fail or stop. This was not a vulnerability, but it closes the biggest operational risk: losing data.

Also checked, with no change needed:
- Every server action calls `requireAdmin()` first; only sign-in and sign-out are open.
- The `next` redirect after sign-in accepts only same-site paths, so it can't be used as an open redirect.
- Inputs are validated with zod on the server, and the database is reached only through Drizzle's parameterised queries.
- **Dependencies:** `npm audit --omit=dev` reports **0** known vulnerabilities in what ships. The full audit lists moderate advisories in development-only tools (drizzle-kit's bundled esbuild, which affects only its dev server; minimatch inside the lint toolchain). Neither is in the Docker image or reachable from the internet.

## Risks accepted on purpose

| Risk | Why it's acceptable | Mitigation |
|---|---|---|
| No second factor | Your decision (D11). One user, one login. | Long password minimum, lockout, per-IP limit, activity log. Use a password manager. |
| Someone can trigger the lockout on purpose | The lockout is per account, so repeated failures lock you out too. | It needs many requests from many addresses (10 per address per 15 minutes). A reset on the server with `set-admin.mjs` clears it at once. |
| Rate-limit counters live in memory | Rex is a single process; a restart clears the per-IP counters. | The account lockout is stored in the database and survives restarts. |
| Inline style attributes are allowed by the CSP | React sets bar widths and similar through `style`. Styles cannot run code. | Scripts stay locked to the nonce. |
| 1:1 notes are sent to Claude as written | Your decision (D7). The notes shouldn't contain identifying details. | The associate is never named in the request, and every analysis shows what was sent. |
| Backups sit on the same server by default | Simple, and works out of the box. | Off-server copies are documented in [DEPLOYMENT.md](DEPLOYMENT.md#keep-a-copy-off-the-server). |

## Checklist for running Rex

- [ ] `REX_ENCRYPTION_KEY` is saved in your password manager.
- [ ] The admin password is unique and stored in your password manager.
- [ ] The server has automatic security updates on and a firewall allowing only SSH, 80 and 443.
- [ ] **Back up now** works, and you've completed one restore check (`restore-backup.mjs --out`).
- [ ] Backups are copied off the server.
- [ ] You check **Settings > Security** now and then, and update Rex (`git pull && docker compose up -d --build`) every month or two.
