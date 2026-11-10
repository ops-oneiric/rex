import "server-only";
import { headers } from "next/headers";

/** Client IP as reported by the reverse proxy (Caddy sets X-Forwarded-For). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}
