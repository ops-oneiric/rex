# Deploying and running Rex

This is the runbook for putting Rex on your own server and keeping it healthy. It assumes a fresh Ubuntu 24.04 server; any Linux server that runs Docker works the same way.

Rex runs as two containers:

- **rex**: the app and its SQLite database, in the `rex-data` volume. It is not reachable from the internet directly.
- **caddy**: the only public entry point. It gets and renews the HTTPS certificate automatically and forwards requests to Rex.

## 1. What you need

- A server with 1 CPU, 1 to 2 GB of memory and 10 GB of disk. Rex is light; the database stays small.
- SSH access to it, with a user that can run `sudo`.
- A domain or subdomain you control, for example `rex.example.com`.
- Your Claude API key (you paste it into Rex after it starts, not on the server).

## 2. Prepare the server

Update the system and turn on automatic security updates:

```bash
sudo apt update && sudo apt -y upgrade
```

```bash
sudo apt -y install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

Install Docker with the Compose plugin (Docker's official script):

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker "$USER"
```

Log out and back in so the group change applies (or run `newgrp docker` in the current shell). Check with `docker ps`: it should print a table header, not "permission denied".

Allow only SSH and web traffic through the firewall:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp && sudo ufw enable
```

Docker publishes Caddy's ports itself. Nothing else needs to be open; the app port (3000) stays inside Docker's network.

## 3. Point your domain at the server

At your DNS provider, create an **A record** for your domain (and an AAAA record if the server has IPv6) with the server's public IP address. Wait until it resolves. You can check from any computer:

```bash
dig +short rex.example.com
```

Caddy cannot get a certificate until this points at the server and ports 80 and 443 are open.

## 4. Install Rex

```bash
git clone https://github.com/ops-oneiric/rex.git && cd rex
```

```bash
cp .env.example .env
```

Generate the encryption key:

```bash
openssl rand -base64 32
```

Edit `.env` (for example with `nano .env`) and set:

- `REX_ENCRYPTION_KEY`: the value you just generated.
- `REX_DOMAIN`: your domain, for example `rex.example.com`.

**Save a copy of `REX_ENCRYPTION_KEY` in your password manager now.** It encrypts the stored Claude API key and every backup. Without it, a backup cannot be opened.

Build and start:

```bash
docker compose up -d --build
```

The first build takes a few minutes. Check that both containers are up and Rex reports healthy:

```bash
docker compose ps
```

## 5. Create your admin account

```bash
docker compose exec rex node scripts/set-admin.mjs
```

Choose a username and a password of at least 12 characters. A phrase of four or more words works well.

## 6. First sign-in

Open `https://rex.example.com` and sign in. Then:

1. **Settings > Claude**: paste your Claude API key and press **Test connection**.
2. **Settings > General**: check your time zone. It decides what "today" means across Rex.
3. **Settings > Backups and data**: press **Back up now** once, to confirm backups work on this server.

The [user guide](USER_GUIDE.md) covers the rest of the setup: capabilities, associates and clients.

## 7. Updating Rex

Take a backup first (**Settings > Backups and data > Back up now**), then:

```bash
cd ~/rex && git pull && docker compose up -d --build
```

Database changes apply automatically when Rex starts. Your data stays in the `rex-data` volume across rebuilds.

## 8. Backups

### What happens automatically

- Every night after 2 AM in your Rex time zone, Rex takes a full copy of the database. It uses SQLite's online backup, so it's safe while Rex is in use.
- The copy is encrypted (AES-256-GCM, with a key derived from `REX_ENCRYPTION_KEY`) and saved as `rex-YYYYMMDD-HHMMSS.rexbak` in `/app/data/backups`, inside the Docker volume.
- Backups older than 30 days are deleted, but the newest 7 are always kept.
- **Settings > Backups and data** lists every backup, has **Back up now**, and lets you download any backup. The dashboard warns you if the last backup failed or there hasn't been one for 48 hours.

You can change the schedule in `.env` with `REX_BACKUP_HOUR` and `REX_BACKUP_RETENTION_DAYS`, then run `docker compose up -d` again.

### Keep a copy off the server

A backup on the same disk doesn't survive the server being lost. Pick at least one of these:

- **Download from Settings** now and then, and keep the files with your other records. They are encrypted, so a normal cloud drive is fine.
- **Copy them to a host folder every night** with a cron job on the server, then sync that folder elsewhere (for example with `rsync` from your own computer). Open the crontab:

  ```bash
  crontab -e
  ```

  and add this line (it copies at 4 AM server time):

  ```
  0 4 * * * mkdir -p $HOME/rex-backups && cd $HOME/rex && docker compose cp rex:/app/data/backups/. $HOME/rex-backups/ >/dev/null 2>&1
  ```

  Then, from your own computer:

  ```bash
  rsync -av you@your-server:rex-backups/ ~/Rex-backups/
  ```

- **Write backups straight to another disk**: uncomment the backups line under `volumes` in `docker-compose.yml`, point it at the disk, and run `sudo chown 1000:1000` on that folder so the container can write to it.

Your hosting provider's disk snapshots are a good extra layer, but they don't replace the files above.

### Restoring

Practise this once, so you know it works before you need it.

**Check a backup without touching anything.** On the server:

```bash
cd ~/rex && docker compose exec rex node scripts/restore-backup.mjs /app/data/backups/rex-20261111-020000.rexbak --out /tmp/check.db
```

It decrypts the file, runs SQLite's integrity check and prints how many clients, associates, assignments, 1:1s and escalations it holds. Use the name of a real backup from Settings.

**Replace the live database with a backup:**

```bash
cd ~/rex && docker compose stop rex
```

```bash
docker compose run --rm rex node scripts/restore-backup.mjs /app/data/backups/rex-20261111-020000.rexbak --replace
```

```bash
docker compose start rex
```

The database you replaced is kept beside it as `rex.db.before-restore-<time>`, so the restore can itself be undone.

**Restoring a downloaded backup** (for example onto a new server): first copy it into the container, then follow the steps above with the file's new path:

```bash
docker compose cp ./rex-20261111-020000.rexbak rex:/app/data/backups/
```

A backup only opens with the `REX_ENCRYPTION_KEY` it was made with. On a new server, put the saved key in `.env` before restoring.

## 9. Everyday operations

Reset a forgotten password. This also clears a lockout and signs out every browser:

```bash
cd ~/rex && docker compose exec rex node scripts/set-admin.mjs
```

See what Rex is doing:

```bash
cd ~/rex && docker compose logs -f --tail 100 rex
```

Restart:

```bash
cd ~/rex && docker compose restart
```

Rex reports `ok` at `/api/health`. Docker uses it to mark the container healthy, and you can point an uptime monitor at `https://rex.example.com/api/health`.

## 10. Troubleshooting

| What you see | What to check |
|---|---|
| The browser says the connection isn't secure, or Caddy's logs mention ACME or a certificate challenge | DNS must point at this server and ports 80 and 443 must be open. Check with `docker compose logs caddy`. Caddy retries by itself once the problem is fixed. |
| `permission denied while trying to connect to the docker API at unix:///var/run/docker.sock` | Your user isn't in the `docker` group yet, or you haven't logged in again since adding it. Run `groups`; if `docker` is missing, run `sudo usermod -aG docker "$USER"`. Then log out and back in (or run `newgrp docker`). |
| `Cannot connect to the Docker daemon` | Docker isn't running. Start it with `sudo systemctl enable --now docker`. |
| You sign in and land back on the login page | Rex is being used over plain HTTP. Use the `https://` address. |
| "Sign-in is locked" | Wait for the time shown, or reset the password with `set-admin.mjs` (above). |
| Settings says the encryption key is missing | `REX_ENCRYPTION_KEY` is empty or isn't 32 bytes of base64. Fix `.env`, then run `docker compose up -d`. |
| "The last backup failed" on the dashboard | **Settings > Backups and data** shows the error. A full disk is the usual cause: check with `df -h`. |
| The restore script says "could not be decrypted" | The backup was made with a different `REX_ENCRYPTION_KEY`, or the file was damaged in transfer. |

## 11. If the encryption key is lost

Rex itself keeps working, but you'll need to re-enter the Claude API key, and **existing backups can't be opened**. Generate a new key, put it in `.env`, run `docker compose up -d`, save the Claude key again in Settings, and press **Back up now** so a backup exists under the new key.
