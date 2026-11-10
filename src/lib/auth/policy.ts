/**
 * Pure login-security rules, kept free of server imports so they are unit-testable.
 * With no second factor, these limits are the main defence against password guessing.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/** Consecutive failures allowed before the account locks. */
export const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_BASE_MS = 15 * 60 * 1000;
const LOCKOUT_MAX_MS = 24 * 60 * 60 * 1000;

/** Sessions end after this long without activity... */
export const SESSION_IDLE_MS = 12 * 60 * 60 * 1000;
/** ...and always after this long, active or not. */
export const SESSION_ABSOLUTE_MS = 7 * 24 * 60 * 60 * 1000;

export function validateNewPassword(password: string, username?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters. A short phrase of a few words works well.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    return "The password must not contain the username.";
  }
  if (new Set(password).size < 5) {
    return "The password is too repetitive.";
  }
  return null;
}

/**
 * Lock duration after a failure, given the new consecutive-failure count.
 * 5 failures: 15 min, 6: 30 min, 7: 1 h, ... capped at 24 h. Below the threshold: no lock.
 */
export function lockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < LOCKOUT_THRESHOLD) return 0;
  const exponent = failedAttempts - LOCKOUT_THRESHOLD;
  return Math.min(LOCKOUT_BASE_MS * 2 ** exponent, LOCKOUT_MAX_MS);
}

/** Only allow same-site relative paths as post-login redirects (no open redirects). */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/login")) return fallback;
  return value;
}

/** Fixed-window limiter, in memory. Rex runs as a single process, so this is enough. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns false when the key is over its limit. */
  attempt(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      this.prune(now);
      return true;
    }
    entry.count += 1;
    return entry.count <= this.limit;
  }

  private prune(now: number) {
    if (this.hits.size < 1000) return;
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}

export function formatDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
