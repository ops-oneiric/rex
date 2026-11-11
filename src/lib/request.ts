import "server-only";
import { headers } from "next/headers";

/**
 * Client IP as reported by the reverse proxy. Caddy replaces any X-Forwarded-For a visitor
 * sends with the address it saw, so the last entry is the one our own proxy added; earlier
 * entries could be forged and are ignored.
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",").at(-1)!.trim() || null;
  return h.get("x-real-ip");
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
