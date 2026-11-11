import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { eq, lt, ne, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sha256Hex } from "@/lib/crypto/secrets";
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS } from "./policy";

export const SESSION_COOKIE = "rex_session";
// Avoid a database write on every request: refresh "last seen" at most this often.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function createSession(meta: { ip: string | null; userAgent: string | null }) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_ABSOLUTE_MS);

  // Clear out expired sessions while we are here.
  db.delete(schema.sessions)
    .where(
      or(
        lt(schema.sessions.expiresAt, new Date(now)),
        lt(schema.sessions.lastSeenAt, new Date(now - SESSION_IDLE_MS)),
      ),
    )
    .run();

  db.insert(schema.sessions)
    .values({
      id: sha256Hex(token),
      expiresAt,
      lastSeenAt: new Date(now),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
    })
    .run();

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Returns true when the request carries a live session. Extends the idle timer. */
export async function validateSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;

  const id = sha256Hex(token);
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!session) return false;

  const now = Date.now();
  const expired =
    session.expiresAt.getTime() <= now || session.lastSeenAt.getTime() + SESSION_IDLE_MS <= now;
  if (expired) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
    return false;
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    db.update(schema.sessions)
      .set({ lastSeenAt: new Date(now) })
      .where(eq(schema.sessions.id, id))
      .run();
  }
  return true;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, sha256Hex(token))).run();
  }
  store.delete(SESSION_COOKIE);
}

/** Signs out every session except the current one (used after a password change). */
export async function destroyOtherSessions() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    db.delete(schema.sessions).where(ne(schema.sessions.id, sha256Hex(token))).run();
  } else {
    db.delete(schema.sessions).run();
  }
}

/** Live sessions, newest activity first, with the current one marked. */
export async function listSessions() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const current = token ? sha256Hex(token) : null;
  const now = Date.now();
  return db
    .select()
    .from(schema.sessions)
    .all()
    .filter((s) => s.expiresAt.getTime() > now && s.lastSeenAt.getTime() + SESSION_IDLE_MS > now)
    .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    .map((s) => ({ key: s.id.slice(0, 12), lastSeenAt: s.lastSeenAt, expiresAt: s.expiresAt, ip: s.ip, userAgent: s.userAgent, current: s.id === current }));
}
