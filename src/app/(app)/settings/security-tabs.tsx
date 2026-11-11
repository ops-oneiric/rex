import { Activity, Download, FileSpreadsheet, HardDrive, Laptop, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ACTIVITY_LABELS, failedSignIns, recentSignInActivity } from "@/lib/auth/activity";
import { LOCKOUT_THRESHOLD, PASSWORD_MIN_LENGTH } from "@/lib/auth/policy";
import { listSessions } from "@/lib/auth/session";
import { backupDir, backupHealth, backupHour, listBackups, retentionDays } from "@/lib/backups/service";
import { DATASETS } from "@/lib/export";
import { getHomeTimeZone } from "@/lib/settings";
import { BackupNowButton, SignOutOthersButton } from "./security-controls";

function formatter() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: getHomeTimeZone(),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Chrome on macOS" from a user agent string; good enough to recognise your own devices. */
function describeAgent(ua: string | null): string {
  if (!ua) return "Unknown browser";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "unknown system";
  return `${browser} on ${os}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export async function SecurityTab() {
  const fmt = formatter();
  const sessions = await listSessions();
  const activity = recentSignInActivity();
  const failed = failedSignIns(24);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader icon={<Laptop />} title="Signed-in browsers" description="Sessions end after 12 hours without activity or 7 days in total." />
          <ul className="divide-y divide-rex-900/6">
            {sessions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                <span className="font-medium text-rex-950">{describeAgent(s.userAgent)}</span>
                {s.current && <Badge tone="primary">This browser</Badge>}
                <span className="w-full text-xs text-ink-muted">
                  Last active {fmt.format(s.lastSeenAt)}
                  {s.ip && ` · ${s.ip}`}
                </span>
              </li>
            ))}
          </ul>
          {sessions.length > 1 && (
            <div className="mt-4">
              <SignOutOthersButton />
            </div>
          )}
        </Card>
        <Card>
          <CardHeader icon={<ShieldCheck />} title="Protection in place" />
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink">
            <li>One admin account, with a password of at least {PASSWORD_MIN_LENGTH} characters stored as an argon2id hash.</li>
            <li>After {LOCKOUT_THRESHOLD} wrong passwords the account locks for 15 minutes, doubling each time up to 24 hours.</li>
            <li>Each address gets 10 failed attempts per 15 minutes.</li>
            <li>HTTPS only, with secure, HTTP-only cookies and a strict content security policy.</li>
            <li>The Claude API key and every backup are encrypted with the server&apos;s REX_ENCRYPTION_KEY.</li>
          </ul>
        </Card>
      </div>
      <Card>
        <CardHeader
          icon={<Activity />}
          title="Sign-in activity"
          description={`The last ${activity.length} sign-in events. ${failed === 0 ? "No failed attempts" : `${failed} failed or blocked attempt${failed === 1 ? "" : "s"}`} in the last 24 hours.`}
        />
        {activity.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-ink-muted">
                  <th scope="col" className="py-2 font-medium">When</th>
                  <th scope="col" className="py-2 font-medium">Event</th>
                  <th scope="col" className="py-2 font-medium">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rex-900/6">
                {activity.map((a) => {
                  const bad = a.action === "login.failure" || a.action === "login.locked" || a.action === "login.rate_limited";
                  return (
                    <tr key={a.id}>
                      <td className="tabular py-2 pr-3 whitespace-nowrap text-ink-muted">{fmt.format(a.at)}</td>
                      <td className={bad ? "py-2 pr-3 text-red-800" : "py-2 pr-3 text-ink"}>{ACTIVITY_LABELS[a.action] ?? a.action}</td>
                      <td className="tabular py-2 text-ink-muted">{a.ip ?? "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function BackupsTab() {
  const fmt = formatter();
  const health = backupHealth();
  const backups = listBackups();

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader
          icon={<HardDrive />}
          title="Backups"
          description={`A full encrypted copy of the database every night after ${new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, backupHour())))} your time, kept for ${retentionDays()} days (the newest 7 are always kept).`}
        />
        <div className="space-y-4">
          {!health.enabled && <Alert tone="info">Nightly backups are turned off on this server (REX_BACKUPS=off). You can still back up by hand.</Alert>}
          {health.failing && <Alert tone="error">The last backup failed: {health.lastError}</Alert>}
          {health.enabled && !health.failing && health.stale && (
            <Alert tone="error">There is no backup from the last 48 hours. Back up now, and check the server if this keeps happening.</Alert>
          )}
          <BackupNowButton />
          {backups.length === 0 ? (
            <p className="text-sm text-ink-muted">No backups yet.</p>
          ) : (
            <ul className="divide-y divide-rex-900/6">
              {backups.map((b) => (
                <li key={b.name} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="tabular min-w-0 flex-1 text-ink">{fmt.format(b.createdAt)}</span>
                  <span className="tabular text-xs text-ink-muted">{formatBytes(b.bytes)}</span>
                  <a
                    href={`/api/backups/${b.name}`}
                    download
                    className="inline-flex items-center gap-1 font-medium text-rex-700 hover:text-rex-900"
                    aria-label={`Download backup from ${fmt.format(b.createdAt)}`}
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Download
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">
            Saved on the server in <code className="font-mono">{backupDir()}</code>. A downloaded backup can only be opened with your REX_ENCRYPTION_KEY,
            using scripts/restore-backup.mjs (see docs/DEPLOYMENT.md). Keep a copy of the key somewhere other than the server.
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader icon={<FileSpreadsheet />} title="Export to a spreadsheet" description="Readable CSV files of your own data, with real names. Handle them as you would the app itself." />
        <ul className="divide-y divide-rex-900/6">
          {Object.entries(DATASETS).map(([id, d]) => (
            <li key={id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-rex-950">{d.label}</span>
                <span className="block text-xs text-ink-muted">{d.description}</span>
              </span>
              <a
                href={`/api/export/${id}`}
                download
                className="inline-flex shrink-0 items-center gap-1 font-medium text-rex-700 hover:text-rex-900"
                aria-label={`Download ${d.label} as CSV`}
              >
                <Download className="size-4" aria-hidden="true" />
                CSV
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
